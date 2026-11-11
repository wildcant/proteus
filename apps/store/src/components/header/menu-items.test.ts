import { describe, expect, it } from 'vitest'
import type { StoreProductCategoryTreeNode, StoreProductCollection } from '#/api/generated/model'
import { resolveMenuItems } from './menu-items'

const category = (handle: string, children: StoreProductCategoryTreeNode[] = []): StoreProductCategoryTreeNode => ({
  id: `id-${handle}`,
  name: `Name ${handle}`,
  description: '',
  handle,
  children,
})

const collection = (handle: string): StoreProductCollection => ({
  id: `id-${handle}`,
  title: `Title ${handle}`,
  handle,
  thumbnail: null,
})

const classics = category('men-classics')
const men = category('men', [classics])
const women = category('women')
const categories = [men, women]

describe('resolveMenuItems', () => {
  it('lists every top-level Visible Category, children included, when the store has no menu', () => {
    expect(resolveMenuItems({ categories, navigation: [], collections: [] })).toEqual([
      {
        key: 'id-men',
        label: 'Name men',
        target: { type: 'category', handle: 'men' },
        children: [
          { key: 'id-men-classics', label: 'Name men-classics', target: { type: 'category', handle: 'men-classics' } },
        ],
      },
      { key: 'id-women', label: 'Name women', target: { type: 'category', handle: 'women' }, children: [] },
    ])
  })

  it('follows the menu in its order, linking a Collection by its title and finding a Category at any depth', () => {
    const featured = collection('featured')
    const items = resolveMenuItems({
      categories,
      navigation: [
        { type: 'collection', handle: 'featured' },
        { type: 'category', handle: 'men-classics' },
        { type: 'category', handle: 'men' },
      ],
      collections: [featured],
    })

    expect(items.map(({ label, target }) => ({ label, target }))).toEqual([
      { label: 'Title featured', target: { type: 'collection', handle: 'featured' } },
      { label: 'Name men-classics', target: { type: 'category', handle: 'men-classics' } },
      { label: 'Name men', target: { type: 'category', handle: 'men' } },
    ])
    // Women is a root, but the menu does not name it, so it is not on the menu.
    expect(items.find((item) => item.label === 'Name women')).toBeUndefined()
    expect(items[2]?.children.map((child) => child.label)).toEqual(['Name men-classics'])
  })

  it('skips an entry whose handle names no Visible Category or Collection', () => {
    const items = resolveMenuItems({
      categories,
      navigation: [
        { type: 'category', handle: 'hidden' },
        // A Collection handle that the Category tree happens to hold is still not a Collection.
        { type: 'collection', handle: 'women' },
        { type: 'category', handle: 'women' },
      ],
      collections: [],
    })

    expect(items.map((item) => item.label)).toEqual(['Name women'])
  })
})
