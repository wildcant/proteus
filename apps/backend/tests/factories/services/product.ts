import type { AwilixContainer } from 'awilix'
import type { FindConfig } from '../../../src/core/types/common.js'
import type {
  CreateProductDTO,
  CreateProductOptionDTO,
  CreateProductVariantDTO,
  FilterableProductImageProps,
  FilterableProductProps,
  FilterableProductVariantImageProps,
  FilterableProductVariantProps,
  IProductModuleService,
  ProductImageDTO,
  SetProductOptionsDTO,
  UpdateProductVariantDTO,
  VariantImageInput,
} from '../../../src/core/types/index.js'
import { Modules } from '../../../src/core/utils/index.js'
import {
  generateCreateProductDTO,
  generateCreateProductOptionDTO,
  generateCreateProductVariantDTO,
  generateSetProductOptionsDTO,
  generateUpdateProductVariantDTO,
  generateVariantImageInputDTO,
} from '../product-dto.js'

/** Overrides for one variant. `productId` comes from the call, so it is not the caller's to set. */
export type VariantOverrides = Omit<Partial<CreateProductVariantDTO>, 'productId'>

/**
 * A product and the image rows it created, rank-ordered, so callers never list them back
 * just to learn the ids of images they asked for.
 */
export async function createProduct(container: AwilixContainer, overrides?: Partial<CreateProductDTO>) {
  const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)

  const draft = generateCreateProductDTO(overrides)
  const product = await productService.createProduct(draft)
  const images = draft.images?.length
    ? await productService.listProductImages({ productId: product.id }, { order: { rank: 'ASC' } })
    : []

  return { product, images }
}

export async function createProductOption(container: AwilixContainer, overrides?: Partial<CreateProductOptionDTO>) {
  const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)

  return productService.createProductOption(generateCreateProductOptionDTO(overrides))
}

export async function createProductVariants(
  container: AwilixContainer,
  productId: string,
  overrides: VariantOverrides[] = [{}],
) {
  const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)

  return productService.createProductVariants(
    overrides.map((variant) => generateCreateProductVariantDTO({ ...variant, productId })),
  )
}

export async function createProductVariant(
  container: AwilixContainer,
  productId: string,
  overrides?: VariantOverrides,
) {
  const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)

  return productService.createProductVariant(generateCreateProductVariantDTO({ ...overrides, productId }))
}

export async function addImageToVariant(container: AwilixContainer, overrides: Partial<VariantImageInput>[] = [{}]) {
  const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)

  return productService.addImageToVariant(overrides.map((link) => generateVariantImageInputDTO(link)))
}

export async function setProductOptions(
  container: AwilixContainer,
  productId: string,
  overrides?: Partial<SetProductOptionsDTO>,
) {
  const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)

  return productService.setProductOptions(productId, generateSetProductOptionsDTO(overrides))
}

export async function updateProductVariant(
  container: AwilixContainer,
  variantId: string,
  overrides?: Partial<UpdateProductVariantDTO>,
) {
  const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)

  return productService.updateProductVariant(variantId, generateUpdateProductVariantDTO(overrides))
}

// ---- Reads ----

export async function listProducts(container: AwilixContainer, filters?: FilterableProductProps) {
  const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)

  return productService.listProducts(filters)
}

export async function listProductVariants(container: AwilixContainer, filters?: FilterableProductVariantProps) {
  const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)

  return productService.listProductVariants(filters)
}

export async function retrieveProductVariant(container: AwilixContainer, variantId: string) {
  const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)

  return productService.retrieveProductVariant(variantId)
}

export async function listProductImages(
  container: AwilixContainer,
  filters?: FilterableProductImageProps,
  config?: FindConfig<ProductImageDTO>,
) {
  const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)

  return productService.listProductImages(filters, config)
}

export async function listProductVariantImages(
  container: AwilixContainer,
  filters?: FilterableProductVariantImageProps,
) {
  const productService = container.resolve<IProductModuleService>(Modules.PRODUCT)

  return productService.listProductVariantImages(filters)
}
