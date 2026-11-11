import { ErrorTypes } from '@core/errors/app-error.js'
import { faker } from '@faker-js/faker'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import productTagDefinitions from '../../product-tags/definitions.js'
import productDefinitions from '../../products/definitions.js'
import type * as productRoutes from '../../products/route.js'
import type * as categoryByIdRoutes from '../[id]/route.js'
import productCategoryDefinitions from '../definitions.js'
import type * as categoryRoutes from '../route.js'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({
    definitions: [...productCategoryDefinitions, ...productDefinitions, ...productTagDefinitions],
  })
})

test.describe('Ruled Categories', () => {
  test('a tag rule fills a Category, ANDs its conditions, follows retagging and refuses manual picks', async ({
    expect,
    http,
    service,
  }) => {
    const [men, unisex, classics, sport] = await Promise.all(
      ['genero:hombre', 'genero:unisex', 'estilo:clasicos', 'estilo:deporte'].map((value) =>
        service.create.productTag(api.container, { value }),
      ),
    )
    if (!men || !unisex || !classics || !sport) throw new Error('Expected four tags')

    const createProduct = async (tagIds: string[]) => {
      const response = await api.post<typeof productRoutes.PostOutput>('/admin/products', {
        title: `${faker.commerce.productName()} ${faker.string.alphanumeric(6)}`,
        tagIds,
      })
      expect(response.status).toBe(201)
      return response.body.product
    }
    // Tagged before the Category exists: creating the rule must pick them up.
    const menClassic = await createProduct([men.id, classics.id])
    const unisexClassic = await createProduct([unisex.id, classics.id])
    const menSport = await createProduct([men.id, sport.id])
    await createProduct([classics.id])

    const created = await api.post<typeof categoryRoutes.PostOutput>(
      '/admin/product-categories',
      http.admin.createProductCategory({
        rule: [[men.value, unisex.value], [classics.value]],
      }),
    )
    expect(created.status).toBe(201)
    const category = created.body.productCategory
    expect(category.rule).toEqual([[men.value, unisex.value], [classics.value]])

    const members = async () => {
      const response = await api.get<typeof productRoutes.GetOutput>(`/admin/products?categoryId=${category.id}`)
      expect(response.status).toBe(200)
      return response.body.products.map((product) => product.id).sort()
    }
    // (hombre or unisex) and clasicos: the sport shoe and the untagged-gender classic stay out.
    expect(await members()).toEqual([menClassic.id, unisexClassic.id].sort())

    // A product created with matching tags joins on its own.
    const latecomer = await createProduct([unisex.id, classics.id])
    expect(await members()).toEqual([menClassic.id, unisexClassic.id, latecomer.id].sort())

    // Retagging moves products: the sport shoe turns classic and joins, the men's classic turns sport and leaves.
    await api.patch(`/admin/products/${menSport.id}`, { tagIds: [men.id, classics.id] })
    await api.patch(`/admin/products/${menClassic.id}`, { tagIds: [men.id, sport.id] })
    expect(await members()).toEqual([unisexClassic.id, latecomer.id, menSport.id].sort())

    // Ticking the Category on the product does not override the rule.
    await api.patch(`/admin/products/${menClassic.id}`, { categoryIds: [category.id] })
    expect(await members()).toEqual([unisexClassic.id, latecomer.id, menSport.id].sort())

    // Renaming a Tag re-matches its products; deleting one does too.
    await api.patch(`/admin/product-tags/${unisex.id}`, { value: 'genero:todos' })
    expect(await members()).toEqual([menSport.id])
    await api.patch(`/admin/product-tags/${unisex.id}`, { value: unisex.value })
    expect(await members()).toEqual([unisexClassic.id, latecomer.id, menSport.id].sort())
    await api.delete(`/admin/product-tags/${classics.id}`)
    expect(await members()).toEqual([])

    // Changing the rule re-matches every product.
    const changed = await api.patch<typeof categoryByIdRoutes.PatchOutput>(`/admin/product-categories/${category.id}`, {
      rule: [[sport.value]],
    })
    expect(changed.status).toBe(200)
    expect(changed.body.productCategory.rule).toEqual([[sport.value]])
    expect(await members()).toEqual([menClassic.id])

    // A ruled Category's members cannot be picked by hand.
    const picked = await api.post<ApiErrorBody>(`/admin/product-categories/${category.id}/products`, {
      add: [latecomer.id],
    })
    expect(picked.status).toBe(400)
    expect(picked.body.type).toBe(ErrorTypes.NOT_ALLOWED)

    // Clearing the rule makes it manual: the members stay, and picking works again.
    await api.patch(`/admin/product-categories/${category.id}`, { rule: null })
    const manualPick = await api.post(`/admin/product-categories/${category.id}/products`, { add: [latecomer.id] })
    expect(manualPick.status).toBe(200)
    expect(await members()).toEqual([menClassic.id, latecomer.id].sort())

    // An empty rule or an empty condition is refused rather than matching everything.
    for (const rule of [[], [[]]]) {
      const invalid = await api.patch<ApiErrorBody>(`/admin/product-categories/${category.id}`, { rule })
      expect(invalid.status).toBe(400)
    }
  })
})
