import type {
  CreateProductDTO,
  CreateProductOptionDTO,
  CreateProductOptionValueDTO,
  CreateProductVariantDTO,
  ProductOptionRenderAs,
  SetProductOptionsDTO,
  UpdateProductDTO,
  UpdateProductVariantDTO,
  VariantImageInput,
} from '@core/types/index.js'
import { faker } from '@faker-js/faker'

export function generateCreateProductDTO(overrides?: Partial<CreateProductDTO>): CreateProductDTO {
  return {
    title: faker.commerce.productName(),
    ...overrides,
  }
}

export function generateUpdateProductDTO(overrides?: Partial<UpdateProductDTO>): UpdateProductDTO {
  return {
    title: faker.commerce.productName(),
    ...overrides,
  }
}

/** Mirrors the `product_option_render_as` pgEnum. */
const RENDER_AS: readonly ProductOptionRenderAs[] = ['text', 'swatch']

const metadata = () => ({ [faker.lorem.word()]: faker.lorem.word() })

export function generateCreateProductOptionValueDTO(
  overrides?: Partial<CreateProductOptionValueDTO>,
): CreateProductOptionValueDTO {
  return {
    // `createProductOption` nests values under the option it just created, so it overrides this.
    optionId: `opt_${faker.string.alphanumeric(32)}`,
    // Unique on (optionId, value), so two generated values of one option cannot collide.
    value: `${faker.color.human()}-${faker.string.alphanumeric(6)}`,
    rank: faker.number.int({ min: 0, max: 10 }),
    metadata: metadata(),
    ...overrides,
  }
}

/** An option value as it is nested inside a create-option payload, which supplies the option id. */
function generateNestedOptionValue(): Omit<CreateProductOptionValueDTO, 'optionId'> {
  const { optionId: _optionId, ...value } = generateCreateProductOptionValueDTO()
  return value
}

export function generateCreateProductOptionDTO(overrides?: Partial<CreateProductOptionDTO>): CreateProductOptionDTO {
  return {
    // Unique across products where deleted_at is null, so the suffix is not decoration.
    title: `${faker.commerce.productAdjective()}-${faker.string.alphanumeric(8)}`,
    renderAs: faker.helpers.arrayElement(RENDER_AS),
    values: [generateNestedOptionValue(), generateNestedOptionValue()],
    metadata: metadata(),
    ...overrides,
  }
}

export function generateCreateProductVariantDTO(overrides?: Partial<CreateProductVariantDTO>): CreateProductVariantDTO {
  return {
    productId: `prod_${faker.string.alphanumeric(32)}`,
    optionValues: {},
    thumbnail: faker.image.url(),
    sku: faker.string.alphanumeric({ length: 12, casing: 'upper' }),
    barcode: faker.string.numeric(12),
    ean: faker.string.numeric(13),
    upc: faker.string.numeric(12),
    allowBackorder: faker.datatype.boolean(),
    manageInventory: faker.datatype.boolean(),
    hsCode: faker.string.numeric(6),
    originCountry: faker.location.countryCode(),
    midCode: faker.string.alphanumeric(10),
    material: faker.commerce.productMaterial(),
    weight: faker.number.float({ min: 0.1, max: 100, fractionDigits: 2 }),
    length: faker.number.float({ min: 1, max: 200, fractionDigits: 2 }),
    height: faker.number.float({ min: 1, max: 200, fractionDigits: 2 }),
    width: faker.number.float({ min: 1, max: 200, fractionDigits: 2 }),
    variantRank: faker.number.int({ min: 0, max: 100 }),
    metadata: metadata(),
    ...overrides,
  }
}

/** Both ids are NOT NULL FKs; every caller names the image and variant it means. */
export function generateVariantImageInputDTO(overrides?: Partial<VariantImageInput>): VariantImageInput {
  return {
    imageId: `img_${faker.string.alphanumeric(32)}`,
    variantId: `variant_${faker.string.alphanumeric(32)}`,
    ...overrides,
  }
}

/** Array position sets each option's display rank, so the generated entry is a single option. */
export function generateSetProductOptionsDTO(overrides?: Partial<SetProductOptionsDTO>): SetProductOptionsDTO {
  return {
    options: [
      {
        optionId: `opt_${faker.string.alphanumeric(32)}`,
        valueIds: [`optval_${faker.string.alphanumeric(32)}`, `optval_${faker.string.alphanumeric(32)}`],
      },
    ],
    ...overrides,
  }
}

/**
 * `optionValues` is deliberately absent: on an update, omitting it leaves the variant's Option
 * Combination alone, while any generated value would rewrite it — so a caller changing one field
 * would silently reassign the combination too.
 */
export function generateUpdateProductVariantDTO(overrides?: Partial<UpdateProductVariantDTO>): UpdateProductVariantDTO {
  return {
    thumbnail: faker.image.url(),
    sku: faker.string.alphanumeric({ length: 12, casing: 'upper' }),
    barcode: faker.string.numeric(12),
    ean: faker.string.numeric(13),
    upc: faker.string.numeric(12),
    allowBackorder: faker.datatype.boolean(),
    manageInventory: faker.datatype.boolean(),
    hsCode: faker.string.numeric(6),
    originCountry: faker.location.countryCode(),
    midCode: faker.string.alphanumeric(10),
    material: faker.commerce.productMaterial(),
    weight: faker.number.float({ min: 0.1, max: 100, fractionDigits: 2 }),
    length: faker.number.float({ min: 1, max: 200, fractionDigits: 2 }),
    height: faker.number.float({ min: 1, max: 200, fractionDigits: 2 }),
    width: faker.number.float({ min: 1, max: 200, fractionDigits: 2 }),
    variantRank: faker.number.int({ min: 0, max: 100 }),
    metadata: metadata(),
    ...overrides,
  }
}
