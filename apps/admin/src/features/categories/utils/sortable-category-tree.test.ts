import { describe, expect, test } from 'vitest'
import type { AdminProductCategoryTreeNode } from '#/api/generated/model'
import { moveCategoryInTree } from '#/features/categories/utils/move-category-in-tree'
import {
  flattenTree,
  getDropMove,
  getProjection,
  removeChildrenOf,
} from '#/features/categories/utils/sortable-category-tree'

const INDENT = 24

const node = (id: string, children: AdminProductCategoryTreeNode[] = []): AdminProductCategoryTreeNode => ({
  id,
  name: id,
  description: '',
  handle: id,
  parentId: null,
  rank: 0,
  isActive: true,
  isInternal: false,
  createdAt: '',
  updatedAt: '',
  children: children.map((child, rank) => ({ ...child, parentId: id, rank })),
})

const tree = () =>
  [node('men', [node('tops'), node('shoes', [node('sneakers')]), node('socks')]), node('women')].map((root, rank) => ({
    ...root,
    rank,
  }))

/** Drops `activeId` over `overId`, `levels` indents right of where it started, as the page does. */
const drop = (activeId: string, overId: string, levels: number) => {
  const items = flattenTree(tree())
  const draggable = removeChildrenOf(items, [activeId])
  const projection = getProjection(draggable, activeId, overId, levels * INDENT, INDENT)
  if (!projection) throw new Error('no projection')
  return getDropMove(items, activeId, overId, projection)
}

const shape = (nodes: AdminProductCategoryTreeNode[]): unknown[] =>
  nodes.map((category) =>
    category.children.length ? [category.id, category.rank, shape(category.children)] : [category.id, category.rank],
  )

describe('dragging the category tree', () => {
  test('a drop reads as a parent and a rank, and the optimistic tree follows the Rank rule', () => {
    // Reorder among siblings: socks dragged up over tops, same depth.
    expect(drop('socks', 'tops', 0)).toEqual({ id: 'socks', parentId: 'men', rank: 0 })
    // Dragged right under the row above: socks becomes the last child of shoes, after sneakers.
    expect(drop('socks', 'socks', 1)).toEqual({ id: 'socks', parentId: 'shoes', rank: 1 })
    // A row cannot be shallower than the row it pushes down: dropped above tops, women becomes men's
    // first child however far left it is dragged.
    expect(drop('women', 'tops', -1)).toEqual({ id: 'women', parentId: 'men', rank: 0 })
    // Dragged left out of its parent at the bottom of the list: socks lands at the root, last.
    expect(drop('socks', 'women', -1)).toEqual({ id: 'socks', parentId: null, rank: 2 })
    // The subtree travels with its root: shoes moved to the top keeps sneakers as its child.
    expect(drop('shoes', 'men', 0)).toEqual({ id: 'shoes', parentId: null, rank: 0 })
    // Dropped where it already was asks for nothing.
    expect(drop('tops', 'tops', 0)).toBeNull()

    const moved = moveCategoryInTree(tree(), { id: 'shoes', parentId: null, rank: 0 })
    expect(shape(moved)).toEqual([
      ['shoes', 0, [['sneakers', 0]]],
      // The set shoes left keeps a gap, as on the server.
      [
        'men',
        1,
        [
          ['tops', 0],
          ['socks', 2],
        ],
      ],
      ['women', 2],
    ])
    expect(moved[0]?.parentId).toBeNull()
    expect(shape(moveCategoryInTree(tree(), { id: 'women', parentId: 'shoes', rank: 99 }))).toEqual([
      [
        'men',
        0,
        [
          ['tops', 0],
          [
            'shoes',
            1,
            [
              ['sneakers', 0],
              ['women', 1],
            ],
          ],
          ['socks', 2],
        ],
      ],
    ])
  })
})
