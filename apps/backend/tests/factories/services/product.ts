import type { FindConfig } from '../../../src/core/types/common.js'
import type { AppContainer } from '../../../src/core/types/container.js'
import type {
  FilterableProductImageProps,
  FilterableProductProps,
  FilterableProductVariantImageProps,
  FilterableProductVariantProps,
  ProductDTO,
  ProductImageDTO,
} from '../../../src/core/types/product/common.js'
import type {
  CreateProductDTO,
  CreateProductOptionDTO,
  CreateProductTagDTO,
  CreateProductTypeDTO,
  CreateProductVariantDTO,
  ProductMetafieldValuesDTO,
  SetProductOptionsDTO,
  UpdateProductTypeDTO,
  UpdateProductVariantDTO,
  UpsertProductMetafieldDefinitionDTO,
  VariantImageInput,
} from '../../../src/core/types/product/mutations.js'
import { Modules } from '../../../src/core/utils/modules-definition.js'
import {
  generateCreateProductDTO,
  generateCreateProductOptionDTO,
  generateCreateProductTagDTO,
  generateCreateProductTypeDTO,
  generateCreateProductVariantDTO,
  generateSetProductOptionsDTO,
  generateUpdateProductVariantDTO,
  generateUpsertProductMetafieldDefinitionDTO,
  generateVariantImageInputDTO,
} from '../product-dto.js'

/** Overrides for one variant. `productId` comes from the call, so it is not the caller's to set. */
export type VariantOverrides = Omit<Partial<CreateProductVariantDTO>, 'productId'>

/**
 * A product and the image rows it created, rank-ordered, so callers never list them back
 * just to learn the ids of images they asked for.
 */
export async function createProduct(container: AppContainer, overrides?: Partial<CreateProductDTO>) {
  const productService = container.resolve(Modules.PRODUCT)

  const draft = generateCreateProductDTO(overrides)
  const product = await productService.createProduct(draft)
  const images = draft.images?.length
    ? await productService.listProductImages({ productId: product.id }, { order: { rank: 'ASC' } })
    : []

  return { product, images }
}

/**
 * Several products in one `createProducts` call, so every row lands in a single insert and
 * therefore shares one `now()` — which is what makes a `createdAt` tiebreaker testable.
 */
export async function createProducts(container: AppContainer, overrides: Partial<CreateProductDTO>[] = [{}, {}]) {
  const productService = container.resolve(Modules.PRODUCT)

  return productService.createProducts(overrides.map((product) => generateCreateProductDTO(product)))
}

export async function createProductOption(container: AppContainer, overrides?: Partial<CreateProductOptionDTO>) {
  const productService = container.resolve(Modules.PRODUCT)

  return productService.createProductOption(generateCreateProductOptionDTO(overrides))
}

export async function createProductTag(container: AppContainer, overrides?: Partial<CreateProductTagDTO>) {
  const productService = container.resolve(Modules.PRODUCT)

  return productService.createTag(generateCreateProductTagDTO(overrides))
}

/** Metafield definitions, one per override, in order. */
export async function createMetafieldDefinitions(
  container: AppContainer,
  overrides: Partial<UpsertProductMetafieldDefinitionDTO>[] = [{}],
) {
  const productService = container.resolve(Modules.PRODUCT)

  return productService.upsertMetafieldDefinitions(
    overrides.map((definition) => generateUpsertProductMetafieldDefinitionDTO(definition)),
  )
}

/** Replaces the values of the metafields named; the rest are left alone. */
export async function setProductMetafields(
  container: AppContainer,
  productId: string,
  metafields: ProductMetafieldValuesDTO,
) {
  const productService = container.resolve(Modules.PRODUCT)

  return productService.updateProduct(productId, { metafields })
}

export async function createProductType(container: AppContainer, overrides?: Partial<CreateProductTypeDTO>) {
  const productService = container.resolve(Modules.PRODUCT)

  return productService.createType(generateCreateProductTypeDTO(overrides))
}

export async function updateProductType(container: AppContainer, typeId: string, data: UpdateProductTypeDTO) {
  const productService = container.resolve(Modules.PRODUCT)

  return productService.updateType(typeId, data)
}

/** A soft delete: products keep the id, and read no Type. */
export async function deleteProductType(container: AppContainer, typeId: string) {
  const productService = container.resolve(Modules.PRODUCT)

  await productService.softDeleteTypes([typeId])
}

export async function createProductVariants(
  container: AppContainer,
  productId: string,
  overrides: VariantOverrides[] = [{}],
) {
  const productService = container.resolve(Modules.PRODUCT)

  return productService.createProductVariants(
    overrides.map((variant) => generateCreateProductVariantDTO({ ...variant, productId })),
  )
}

export async function createProductVariant(container: AppContainer, productId: string, overrides?: VariantOverrides) {
  const productService = container.resolve(Modules.PRODUCT)

  return productService.createProductVariant(generateCreateProductVariantDTO({ ...overrides, productId }))
}

export async function addImageToVariant(container: AppContainer, overrides: Partial<VariantImageInput>[] = [{}]) {
  const productService = container.resolve(Modules.PRODUCT)

  return productService.addImageToVariant(overrides.map((link) => generateVariantImageInputDTO(link)))
}

export async function setProductOptions(
  container: AppContainer,
  productId: string,
  overrides?: Partial<SetProductOptionsDTO>,
) {
  const productService = container.resolve(Modules.PRODUCT)

  return productService.setProductOptions(productId, generateSetProductOptionsDTO(overrides))
}

export async function updateProductVariant(
  container: AppContainer,
  variantId: string,
  overrides?: Partial<UpdateProductVariantDTO>,
) {
  const productService = container.resolve(Modules.PRODUCT)

  return productService.updateProductVariant(variantId, generateUpdateProductVariantDTO(overrides))
}

// ---- Reads ----

export async function listProducts(
  container: AppContainer,
  filters?: FilterableProductProps,
  config?: FindConfig<ProductDTO>,
) {
  const productService = container.resolve(Modules.PRODUCT)

  return productService.listProducts(filters, config)
}

export async function listProductVariants(container: AppContainer, filters?: FilterableProductVariantProps) {
  const productService = container.resolve(Modules.PRODUCT)

  return productService.listProductVariants(filters)
}

export async function retrieveProductVariant(container: AppContainer, variantId: string) {
  const productService = container.resolve(Modules.PRODUCT)

  return productService.retrieveProductVariant(variantId)
}

export async function listProductImages(
  container: AppContainer,
  filters?: FilterableProductImageProps,
  config?: FindConfig<ProductImageDTO>,
) {
  const productService = container.resolve(Modules.PRODUCT)

  return productService.listProductImages(filters, config)
}

export async function listProductVariantImages(container: AppContainer, filters?: FilterableProductVariantImageProps) {
  const productService = container.resolve(Modules.PRODUCT)

  return productService.listProductVariantImages(filters)
}

export async function listProductOptionsForProduct(container: AppContainer, productId: string) {
  const productService = container.resolve(Modules.PRODUCT)

  return productService.listProductOptionsForProduct(productId)
}
