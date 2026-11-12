import type { StoreProductCategoryTreeNode } from '#/api/generated/model'

/** A Category as the category page needs it: itself, and the Categories above it, root first. */
type CategoryTrail = { category: StoreProductCategoryTreeNode; ancestors: StoreProductCategoryTreeNode[] }

/** The Category with this handle and its ancestors, or `undefined` when the Visible tree has none. */
export function findCategoryTrail(
  nodes: StoreProductCategoryTreeNode[],
  handle: string,
  ancestors: StoreProductCategoryTreeNode[] = [],
): CategoryTrail | undefined {
  for (const node of nodes) {
    if (node.handle === handle) return { category: node, ancestors }
    const found = findCategoryTrail(node.children, handle, [...ancestors, node])
    if (found) return found
  }
  return undefined
}
