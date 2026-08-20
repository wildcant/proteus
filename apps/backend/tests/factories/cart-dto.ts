import { BigNumber } from '@core/db/bignum.js'
import type { CartAddressDTO, CartDTO, CartLineItemDTO, CartShippingMethodDTO } from '@core/types/cart/common.js'
import { faker } from '@faker-js/faker'

export function generateCartDTO(overrides?: Partial<CartDTO>): CartDTO {
  return {
    id: `cart_${faker.string.alphanumeric(32)}`,
    regionId: null,
    customerId: null,
    salesChannelId: null,
    email: faker.internet.email(),
    currencyCode: faker.finance.currencyCode().toLowerCase(),
    status: 'active',
    shippingAddressId: null,
    billingAddressId: null,
    completedAt: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export function generateCartAddressDTO(overrides?: Partial<CartAddressDTO>): CartAddressDTO {
  return {
    id: `caaddr_${faker.string.alphanumeric(32)}`,
    customerId: null,
    company: faker.company.name(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    address1: faker.location.streetAddress(),
    address2: null,
    city: faker.location.city(),
    countryCode: faker.location.countryCode('alpha-2'),
    province: faker.location.state(),
    postalCode: faker.location.zipCode(),
    phone: faker.phone.number(),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export function generateCartLineItemDTO(overrides?: Partial<CartLineItemDTO>): CartLineItemDTO {
  return {
    id: `cali_${faker.string.alphanumeric(32)}`,
    cartId: `cart_${faker.string.alphanumeric(32)}`,
    title: faker.commerce.productName(),
    subtitle: null,
    thumbnail: null,
    quantity: faker.number.int({ min: 1, max: 10 }),
    variantId: null,
    productId: null,
    productTitle: null,
    productDescription: null,
    productSubtitle: null,
    productType: null,
    productHandle: null,
    variantSku: null,
    variantBarcode: null,
    variantTitle: null,
    variantOptionValues: null,
    requiresShipping: true,
    isDiscountable: true,
    isGiftcard: false,
    isTaxInclusive: false,
    compareAtUnitPrice: null,
    unitPrice: new BigNumber(faker.number.int({ min: 100, max: 100000 })),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export function generateCartShippingMethodDTO(overrides?: Partial<CartShippingMethodDTO>): CartShippingMethodDTO {
  return {
    id: `casm_${faker.string.alphanumeric(32)}`,
    cartId: `cart_${faker.string.alphanumeric(32)}`,
    name: faker.helpers.arrayElement(['Standard Shipping', 'Express Shipping', 'Overnight']),
    description: null,
    amount: new BigNumber(faker.number.int({ min: 100, max: 5000 })),
    isTaxInclusive: false,
    shippingOptionId: `so_${faker.string.alphanumeric(32)}`,
    data: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}
