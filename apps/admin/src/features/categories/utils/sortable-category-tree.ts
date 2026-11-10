import type { UniqueIdentifier } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { AdminProductCategoryTreeNode } from '#/api/generated/model'
import type { CategoryMove } from '#/features/categories/utils/move-category-in-tree'

/**
 * The drag tree's geometry, ported from Medusa's sortable tree (itself dnd-kit's tree example). The
 * tree is dragged as one flat list; how far right a row is dropped decides its depth, and its depth
 * and the row above decide its parent.
 */
export type FlatTreeItem = {
  id: string
  parentId: string | null
  /** 0 for a root. */
  depth: number
  category: AdminProductCategoryTreeNode
}

export type Projection = {
  depth: number
  maxDepth: number
  minDepth: number
  parentId: string | null
}

/** Display order: each Category followed by its descendants. */
export function flattenTree(nodes: AdminProductCategoryTreeNode[], parentId: string | null = null, depth = 0) {
  return nodes.flatMap((category): FlatTreeItem[] => [
    { id: category.id, parentId, depth, category },
    ...flattenTree(category.children, category.id, depth + 1),
  ])
}

/** Drops the descendants of `ids`, which travel with their ancestor instead of being drop targets. */
export function removeChildrenOf(items: FlatTreeItem[], ids: UniqueIdentifier[]): FlatTreeItem[] {
  const excluded = new Set(ids)
  return items.filter((item) => {
    if (item.parentId && excluded.has(item.parentId)) {
      excluded.add(item.id)
      return false
    }
    return true
  })
}

/**
 * Where the dragged row would land if dropped over `overId`, `dragOffset` pixels right of where it
 * started. The depth is clamped between the row below (a row cannot be shallower than the one it
 * pushes down) and one deeper than the row above (it can become that row's first child, no deeper).
 */
export function getProjection(
  items: FlatTreeItem[],
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier,
  dragOffset: number,
  indentationWidth: number,
): Projection | null {
  const overIndex = items.findIndex(({ id }) => id === overId)
  const activeIndex = items.findIndex(({ id }) => id === activeId)
  const activeItem = items[activeIndex]
  if (!activeItem || overIndex === -1) return null

  const reordered = arrayMove(items, activeIndex, overIndex)
  const previousItem = reordered[overIndex - 1]
  const nextItem = reordered[overIndex + 1]
  const maxDepth = previousItem ? previousItem.depth + 1 : 0
  const minDepth = nextItem ? nextItem.depth : 0
  const projectedDepth = activeItem.depth + Math.round(dragOffset / indentationWidth)
  const depth = Math.max(minDepth, Math.min(projectedDepth, maxDepth))

  const parentId = () => {
    if (depth === 0 || !previousItem) return null
    if (depth === previousItem.depth) return previousItem.parentId
    if (depth > previousItem.depth) return previousItem.id
    return (
      reordered
        .slice(0, overIndex)
        .reverse()
        .find((item) => item.depth === depth)?.parentId ?? null
    )
  }

  return { depth, maxDepth, minDepth, parentId: parentId() }
}

/**
 * The move a drop asks for, or null when the row lands where it already was. `items` is the whole
 * flattened tree; the rank is the row's position among the siblings it lands between.
 */
export function getDropMove(
  items: FlatTreeItem[],
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier,
  projection: Projection,
): CategoryMove | null {
  const activeIndex = items.findIndex(({ id }) => id === activeId)
  const overIndex = items.findIndex(({ id }) => id === overId)
  const activeItem = items[activeIndex]
  if (!activeItem || overIndex === -1) return null

  const placed = { ...activeItem, parentId: projection.parentId, depth: projection.depth }
  const reordered = arrayMove(
    items.map((item) => (item.id === activeItem.id ? placed : item)),
    activeIndex,
    overIndex,
  )
  const siblings = reordered.filter((item) => item.parentId === projection.parentId)
  const rank = siblings.findIndex((item) => item.id === activeItem.id)

  const originalSiblings = items.filter((item) => item.parentId === activeItem.parentId)
  const originalRank = originalSiblings.findIndex((item) => item.id === activeItem.id)
  if (projection.parentId === activeItem.parentId && rank === originalRank) return null

  return { id: activeItem.id, parentId: projection.parentId, rank }
}
