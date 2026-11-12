import { ErrorTypes } from '@core/errors/app-error.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import { sql } from 'drizzle-orm'
import type * as categoryByIdRoutes from '../[id]/route.js'
import productCategoryDefinitions from '../definitions.js'
import type * as categoryRoutes from '../route.js'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: productCategoryDefinitions })
})

test.describe('Category tree', () => {
  test('a merchant builds, edits and prunes a two-level tree', async ({ expect, http }) => {
    const createCategory = async (body: object) => {
      const response = await api.post<typeof categoryRoutes.PostOutput>('/admin/product-categories', body)
      expect(response.status).toBe(201)
      return response.body.productCategory
    }

    const men = await createCategory(http.admin.createProductCategory({ name: 'Men', handle: undefined }))
    // Handle generated from the name; Active and Internal off until the merchant turns them on.
    expect(men).toMatchObject({ handle: 'men', parentId: null, rank: 0, isActive: false, isInternal: false })

    const women = await createCategory(http.admin.createProductCategory())
    const tops = await createCategory(http.admin.createProductCategory({ name: 'Tops', parentId: men.id }))
    const shoes = await createCategory(http.admin.createProductCategory({ parentId: men.id }))
    // Placed first among the existing siblings: the set is renumbered 0..n-1 around it.
    const sale = await createCategory(http.admin.createProductCategory({ parentId: men.id, rank: 0 }))
    // A rank past the end appends.
    const socks = await createCategory(http.admin.createProductCategory({ parentId: men.id, rank: 99 }))
    expect(socks.rank).toBe(3)

    const tree = await api.get<typeof categoryRoutes.GetOutput>('/admin/product-categories')
    expect(tree.status).toBe(200)
    expect(tree.body.productCategories.map((root) => root.id)).toEqual([men.id, women.id])
    const menChildren = tree.body.productCategories[0]?.children ?? []
    expect(menChildren.map((child) => [child.id, child.rank])).toEqual([
      [sale.id, 0],
      [tops.id, 1],
      [shoes.id, 2],
      [socks.id, 3],
    ])
    expect(tree.body.productCategories[1]?.children).toEqual([])

    const edited = await api.patch<typeof categoryByIdRoutes.PatchOutput>(`/admin/product-categories/${tops.id}`, {
      name: 'T-shirts',
      description: 'Short sleeves',
      isActive: true,
    })
    expect(edited.status).toBe(200)
    // The handle is never regenerated from a new name.
    expect(edited.body.productCategory).toMatchObject({ name: 'T-shirts', handle: 'tops', isActive: true })
    const retrieved = await api.get<typeof categoryByIdRoutes.GetOutput>(`/admin/product-categories/${tops.id}`)
    expect(retrieved.body.productCategory.description).toBe('Short sleeves')

    const refused = await api.delete<ApiErrorBody>(`/admin/product-categories/${men.id}`)
    expect(refused.status).toBe(400)
    expect(refused.body.type).toBe(ErrorTypes.NOT_ALLOWED)
    // The admin shows this message to the merchant as it comes, so it names the remedy rather than
    // the foreign key that refused.
    expect(refused.body.message).toBe(
      'A category with subcategories cannot be deleted. Delete or move its subcategories first.',
    )

    const deleted = await api.delete<typeof categoryByIdRoutes.DeleteOutput>(`/admin/product-categories/${tops.id}`)
    expect(deleted.body).toEqual({ id: tops.id, deleted: true })
    const gone = await api.get<ApiErrorBody>(`/admin/product-categories/${tops.id}`)
    expect(gone.status).toBe(404)

    const duplicate = await api.post<ApiErrorBody>(
      '/admin/product-categories',
      http.admin.createProductCategory({ handle: shoes.handle }),
    )
    expect(duplicate.body.type).toBe(ErrorTypes.DUPLICATE_ERROR)

    // The refused delete left the parent and its remaining children in place.
    const after = await api.get<typeof categoryRoutes.GetOutput>('/admin/product-categories')
    expect(after.body.productCategories[0]?.children.map((child) => child.id)).toEqual([sale.id, shoes.id, socks.id])
  })
})

test.describe('Organize', () => {
  test('a merchant reorders siblings, moves Categories between parents and to the root', async ({
    expect,
    getDb,
    http,
  }) => {
    const createCategory = async (body: object) => {
      const response = await api.post<typeof categoryRoutes.PostOutput>('/admin/product-categories', body)
      return response.body.productCategory
    }
    const move = (id: string, body: object) =>
      api.patch<typeof categoryByIdRoutes.PatchOutput>(`/admin/product-categories/${id}`, body)
    const readTree = async () =>
      (await api.get<typeof categoryRoutes.GetOutput>('/admin/product-categories')).body.productCategories
    type Node = Awaited<ReturnType<typeof readTree>>[number]
    // Each set as [id, rank], so a stale rank fails as loudly as a wrong order.
    const ranks = (nodes: Node[] | undefined) => (nodes ?? []).map((node) => [node.id, node.rank])

    const men = await createCategory(http.admin.createProductCategory())
    const women = await createCategory(http.admin.createProductCategory())
    const tops = await createCategory(http.admin.createProductCategory({ parentId: men.id }))
    const shoes = await createCategory(http.admin.createProductCategory({ parentId: men.id }))
    const socks = await createCategory(http.admin.createProductCategory({ parentId: men.id }))
    const sneakers = await createCategory(http.admin.createProductCategory({ parentId: shoes.id }))

    // Reorder within one set: the moved row is left out while the siblings are read, then inserted.
    const reordered = await move(socks.id, { rank: 0 })
    expect(reordered.status).toBe(200)
    expect(reordered.body.productCategory).toMatchObject({ parentId: men.id, rank: 0 })
    let tree = await readTree()
    expect(ranks(tree[0]?.children)).toEqual([
      [socks.id, 0],
      [tops.id, 1],
      [shoes.id, 2],
    ])

    // Move across parents, carrying its subtree. The set it left keeps a gap, which changes no order.
    await move(shoes.id, { parentId: women.id, rank: 0 })
    tree = await readTree()
    expect(ranks(tree[0]?.children)).toEqual([
      [socks.id, 0],
      [tops.id, 1],
    ])
    expect(ranks(tree[1]?.children)).toEqual([[shoes.id, 0]])
    expect(ranks(tree[1]?.children[0]?.children)).toEqual([[sneakers.id, 0]])

    // To the root, between the two roots. A parent change with no rank would append instead.
    await move(tops.id, { parentId: null, rank: 1 })
    tree = await readTree()
    expect(ranks(tree)).toEqual([
      [men.id, 0],
      [tops.id, 1],
      [women.id, 2],
    ])
    await move(socks.id, { parentId: women.id })
    tree = await readTree()
    expect(ranks(tree[2]?.children)).toEqual([
      [shoes.id, 0],
      [socks.id, 1],
    ])
    // Naming the parent it already has is no move: without a rank it keeps its place.
    await move(shoes.id, { parentId: women.id })
    tree = await readTree()
    expect(ranks(tree[2]?.children)).toEqual([
      [shoes.id, 0],
      [socks.id, 1],
    ])

    // Under itself, or under its own descendant, would cut the subtree off the tree.
    for (const parentId of [women.id, sneakers.id]) {
      const refused = await move(women.id, { parentId })
      expect(refused.status).toBe(400)
      expect(refused.body).toMatchObject({ type: ErrorTypes.INVALID_ARGUMENT })
    }
    const missingParent = await move(socks.id, { parentId: 'pcat_missing' })
    expect(missingParent.status).toBe(404)
    tree = await readTree()
    expect(ranks(tree[2]?.children)).toEqual([
      [shoes.id, 0],
      [socks.id, 1],
    ])

    // Two concurrent reorders can leave a duplicate rank; the next write in that set heals it.
    await getDb().execute(sql`UPDATE product_category SET rank = 0 WHERE parent_id IS NULL`)
    await move(men.id, { rank: 2 })
    tree = await readTree()
    // Tied siblings are read in id order, then renumbered 0..n-1 around the placed row.
    const [firstTied, secondTied] = [tops.id, women.id].sort()
    expect(ranks(tree)).toEqual([
      [firstTied, 0],
      [secondTied, 1],
      [men.id, 2],
    ])
  })
})
