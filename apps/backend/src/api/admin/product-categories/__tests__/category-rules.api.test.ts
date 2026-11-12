import { ErrorTypes } from '@core/errors/app-error.js'
import type { ProductMetafieldValuesDTO } from '@core/types/product/mutations.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import type * as productByIdRoutes from '../../products/[id]/route.js'
import productDefinitions from '../../products/definitions.js'
import type * as productRoutes from '../../products/route.js'
import type * as categoryByIdRoutes from '../[id]/route.js'
import productCategoryDefinitions from '../definitions.js'
import type * as categoryRoutes from '../route.js'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: [...productCategoryDefinitions, ...productDefinitions] })
})

test.describe('Ruled Categories', () => {
  test('a rule fills a Category from metafields, ANDs its keys, ORs their values, follows re-classifying and refuses manual picks', async ({
    expect,
    http,
    service,
  }) => {
    await service.create.metafieldDefinitions(api.container, [
      { key: 'genero', name: 'Género' },
      { key: 'estilo', name: 'Estilo' },
    ])
    const createProduct = async (metafields: ProductMetafieldValuesDTO) =>
      (await service.create.product(api.container, { metafields })).product

    // Classified before the Category exists: creating the rule must pick them up.
    const menClassic = await createProduct({ genero: ['hombre'], estilo: ['clasicos'] })
    const unisexClassic = await createProduct({ genero: ['unisex'], estilo: ['clasicos'] })
    const menSport = await createProduct({ genero: ['hombre'], estilo: ['deporte'] })
    await createProduct({ estilo: ['clasicos'] })

    const rule = { genero: ['hombre', 'unisex'], estilo: ['clasicos'] }
    const created = await api.post<typeof categoryRoutes.PostOutput>(
      '/admin/product-categories',
      http.admin.createProductCategory({ rule }),
    )
    expect(created.status).toBe(201)
    const category = created.body.productCategory
    expect(category.rule).toEqual(rule)

    const members = async () => {
      const response = await api.get<typeof productRoutes.GetOutput>(`/admin/products?categoryId=${category.id}`)
      expect(response.status).toBe(200)
      return response.body.products.map((product) => product.id).sort()
    }
    // (hombre or unisex) and clasicos: the sport shoe and the classic with no género stay out.
    expect(await members()).toEqual([menClassic.id, unisexClassic.id].sort())

    // A product created with matching metafields joins on its own.
    const latecomer = await createProduct({ genero: ['unisex'], estilo: ['clasicos'] })
    expect(await members()).toEqual([menClassic.id, unisexClassic.id, latecomer.id].sort())

    // Re-classifying moves products: the sport shoe turns classic and joins, the men's classic turns
    // sport and leaves. Its género is not named, so it is left as it was.
    await service.update.productMetafields(api.container, menSport.id, { estilo: ['clasicos'] })
    await service.update.productMetafields(api.container, menClassic.id, { estilo: ['deporte'] })
    expect(await members()).toEqual([unisexClassic.id, latecomer.id, menSport.id].sort())

    // Clearing a metafield takes the product out.
    await service.update.productMetafields(api.container, latecomer.id, { genero: [] })
    expect(await members()).toEqual([unisexClassic.id, menSport.id].sort())

    // Ticking the Category on the product does not override the rule.
    await api.patch(`/admin/products/${menClassic.id}`, { categoryIds: [category.id] })
    expect(await members()).toEqual([unisexClassic.id, menSport.id].sort())

    // The product shows its metafields, by key, as they were written.
    const detail = await api.get<typeof productByIdRoutes.GetOutput>(`/admin/products/${menClassic.id}`)
    expect(detail.body.product.metafields).toEqual([
      { key: 'estilo', name: 'Estilo', values: ['deporte'] },
      { key: 'genero', name: 'Género', values: ['hombre'] },
    ])

    // Changing the rule re-matches every product.
    const changed = await api.patch<typeof categoryByIdRoutes.PatchOutput>(`/admin/product-categories/${category.id}`, {
      rule: { estilo: ['deporte'] },
    })
    expect(changed.status).toBe(200)
    expect(changed.body.productCategory.rule).toEqual({ estilo: ['deporte'] })
    expect(await members()).toEqual([menClassic.id])

    // A rule naming a metafield nothing defines is refused, and the rule stays as it was.
    const undefinedKey = await api.patch<ApiErrorBody>(`/admin/product-categories/${category.id}`, {
      rule: { color: ['rojo'] },
    })
    expect(undefinedKey.status).toBe(400)
    expect(undefinedKey.body.type).toBe(ErrorTypes.INVALID_DATA)
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
    for (const invalidRule of [{}, { genero: [] }]) {
      const invalid = await api.patch<ApiErrorBody>(`/admin/product-categories/${category.id}`, { rule: invalidRule })
      expect(invalid.status).toBe(400)
    }
  })

  test('a rule on the vendor field fills a Category from the brand, ignoring case, and follows a brand change', async ({
    expect,
    http,
    service,
  }) => {
    await service.create.metafieldDefinitions(api.container, [
      { key: 'genero', name: 'Género' },
      { key: 'marca', name: 'Marca', source: 'vendor' },
    ])
    const createProduct = async (brand: string | null, metafields: ProductMetafieldValuesDTO = {}) =>
      (await service.create.product(api.container, { brand, metafields })).product

    const nike = await createProduct('Nike', { genero: ['hombre'] })
    const shoutedNike = await createProduct('NIKE', { genero: ['hombre'] })
    const adidas = await createProduct('Adidas', { genero: ['hombre'] })
    const womenNike = await createProduct('Nike', { genero: ['mujer'] })
    await createProduct(null, { genero: ['hombre'] })

    const created = await api.post<typeof categoryRoutes.PostOutput>(
      '/admin/product-categories',
      http.admin.createProductCategory({ rule: { marca: ['Nike'], genero: ['hombre'] } }),
    )
    expect(created.status).toBe(201)
    const category = created.body.productCategory
    const members = async () => {
      const response = await api.get<typeof productRoutes.GetOutput>(`/admin/products?categoryId=${category.id}`)
      expect(response.status).toBe(200)
      return response.body.products.map((product) => product.id).sort()
    }
    // The brand condition ANDs with the metafield one, and matches whatever the case.
    expect(await members()).toEqual([nike.id, shoutedNike.id].sort())

    // A brand change moves the product, both ways.
    await service.update.product(api.container, adidas.id, { brand: 'nike' })
    await service.update.product(api.container, nike.id, { brand: 'Puma' })
    expect(await members()).toEqual([shoutedNike.id, adidas.id].sort())

    // The product shows its brand; the vendor field is not one of its metafields.
    const detail = await api.get<typeof productByIdRoutes.GetOutput>(`/admin/products/${womenNike.id}`)
    expect(detail.body.product.brand).toBe('Nike')
    expect(detail.body.product.metafields).toEqual([{ key: 'genero', name: 'Género', values: ['mujer'] }])
  })
})
