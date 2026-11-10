import type { AdminProductCategoryTreeNode } from '#/api/generated/model'

export type CategoryMove = {
  id: string
  /** null moves the Category to the root. */
  parentId: string | null
  /** Position among the siblings it lands in. */
  rank: number
}

/**
 * The tree as the server will hold it after `move` — what the Organize page shows before the save
 * answers. Mirrors the Rank rule: the target set is renumbered 0..n-1, the set it left keeps a gap.
 * The tree is never mutated in place, so the previous one stays intact for a rollback.
 */
export function moveCategoryInTree(
  nodes: AdminProductCategoryTreeNode[],
  move: CategoryMove,
): AdminProductCategoryTreeNode[] {
  const moved = findCategory(nodes, move.id)
  if (!moved) return nodes

  const withoutMoved = removeCategory(nodes, move.id)
  const placed = { ...moved, parentId: move.parentId }
  const insert = (siblings: AdminProductCategoryTreeNode[]) => {
    const next = [...siblings]
    next.splice(Math.min(move.rank, next.length), 0, placed)
    return next.map((sibling, rank) => ({ ...sibling, rank }))
  }

  if (move.parentId === null) return insert(withoutMoved)
  const parentId = move.parentId
  const insertUnder = (siblings: AdminProductCategoryTreeNode[]): AdminProductCategoryTreeNode[] =>
    siblings.map((node) =>
      node.id === parentId
        ? { ...node, children: insert(node.children) }
        : { ...node, children: insertUnder(node.children) },
    )
  return insertUnder(withoutMoved)
}

function findCategory(nodes: AdminProductCategoryTreeNode[], id: string): AdminProductCategoryTreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findCategory(node.children, id)
    if (found) return found
  }
  return undefined
}

function removeCategory(nodes: AdminProductCategoryTreeNode[], id: string): AdminProductCategoryTreeNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => ({ ...node, children: removeCategory(node.children, id) }))
}
