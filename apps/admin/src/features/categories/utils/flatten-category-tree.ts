import type { AdminProductCategoryTreeNode } from '#/api/generated/model'

export type FlatCategory = {
  category: AdminProductCategoryTreeNode
  /** 0 for a root. */
  depth: number
  /** Ancestor names, root first — names repeat across the tree, so a name alone is ambiguous. */
  ancestors: string[]
}

/** The tree in display order: each Category followed by its descendants, siblings by rank. */
export function flattenCategoryTree(nodes: AdminProductCategoryTreeNode[], ancestors: string[] = []): FlatCategory[] {
  return nodes.flatMap((category) => [
    { category, depth: ancestors.length, ancestors },
    ...flattenCategoryTree(category.children, [...ancestors, category.name]),
  ])
}
