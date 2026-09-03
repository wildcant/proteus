import type { AwilixContainer } from 'awilix'
import { BigNumber } from '../../../src/core/bignumber.js'
import type {
  CreateCartDTO,
  CreateLineItemDTO,
  CreateShippingMethodDTO,
  UpdateCartWithAddressesDTO,
} from '../../../src/core/types/cart/mutations.js'
import type { CreatePriceDTO } from '../../../src/core/types/pricing/mutations.js'
import type { CreateProductDTO } from '../../../src/core/types/product/mutations.js'
import { generateCreateLineItemDTO } from '../cart-dto.js'
import { generateCreatePriceDTO } from '../pricing-dto.js'
import { addCartAddresses, addLineItem, addShippingMethod, createCart } from './cart.js'
import { type StockVariantOptions, stockVariant } from './inventory.js'
import { createPaymentSessionForCart } from './payment.js'
import { priceVariants } from './pricing.js'
import { createProduct, createProductVariant, type VariantOverrides } from './product.js'

export type CreateCheckoutReadyCartOptions = {
  cart?: Partial<CreateCartDTO>
  lineItem?: Partial<CreateLineItemDTO>
  shippingMethod?: Partial<CreateShippingMethodDTO>
  /** Stock backing the line item's variant. `null` leaves the variant untracked, so
   *  `reserve-inventory` finds no mapping and reserves nothing. */
  inventory?: Omit<StockVariantOptions, 'variantId'> | null
  /** `null` leaves the cart without a payment collection, which `validate-cart-payments` rejects. */
  payment?: { providerId?: string } | null
  /** Addresses attached before completion, the way `update-cart` does mid-checkout. Omitted
   *  leaves the cart with none, which is what an order with no shipping address is made from. */
  addresses?: Partial<UpdateCartWithAddressesDTO>
}

/**
 * A cart that satisfies every validation step of `complete-cart`: a line item with a variant,
 * a shipping method, stock behind the variant, and a processable payment session.
 *
 * Each piece is overridable, and inventory or payment can be dropped entirely, so a test
 * that wants one thing wrong — sold out, unpayable, no email — changes one key instead of
 * rebuilding the graph. Every created entity is returned; take what you need.
 */
export async function createCheckoutReadyCart(
  container: AwilixContainer,
  options: CreateCheckoutReadyCartOptions = {},
) {
  // Resolved up front so the variant backing the stock is the one the line item references.
  const lineItemInput = generateCreateLineItemDTO(options.lineItem)

  const cart = await createCart(container, options.cart)
  const lineItem = await addLineItem(container, cart.id, lineItemInput)
  const shippingMethod = await addShippingMethod(container, cart.id, options.shippingMethod)
  const addresses = options.addresses ? await addCartAddresses(container, cart.id, options.addresses) : []

  // Exactly what this cart orders, so it completes deterministically whatever quantity the
  // generator picked, and a second reservation for the same cart is still an oversell.
  const inventory =
    options.inventory === null || !lineItem.variantId
      ? null
      : await stockVariant(container, {
          ...options.inventory,
          level: { stockedQuantity: lineItemInput.quantity, ...options.inventory?.level },
          variantId: lineItem.variantId,
        })

  const total = new BigNumber(Number(lineItem.unitPrice) * lineItem.quantity + Number(shippingMethod.amount))

  const payment =
    options.payment === null
      ? null
      : await createPaymentSessionForCart(container, {
          cartId: cart.id,
          amount: total,
          currencyCode: cart.currencyCode,
          providerId: options.payment?.providerId,
        })

  return {
    cart,
    lineItem,
    shippingMethod,
    addresses,
    total,
    variantId: lineItem.variantId,
    inventoryItem: inventory?.inventoryItem ?? null,
    inventoryLevel: inventory?.inventoryLevel ?? null,
    paymentCollection: payment?.paymentCollection ?? null,
    paymentSession: payment?.paymentSession ?? null,
  }
}

export type CreateSellableVariantOptions = {
  product?: Partial<CreateProductDTO>
  variant?: VariantOverrides
  price?: Partial<CreatePriceDTO>
  /** Stock behind the variant. `null` leaves it untracked, which the storefront counts as buyable. */
  inventory?: Omit<StockVariantOptions, 'variantId'> | null
}

/**
 * A product a shopper can actually put in their bag: published, with a variant, a price in some
 * currency, and stock behind it. `add-to-cart` refuses anything missing one of those, so a test
 * about merging or quantities needs all four standing before it reaches its own subject.
 *
 * The price is returned rather than left to be read back, because it is the number the workflow
 * is supposed to write onto the line item — the assertion every pricing test makes.
 */
export async function createSellableVariant(container: AwilixContainer, options: CreateSellableVariantOptions = {}) {
  const { product } = await createProduct(container, { status: 'published', ...options.product })
  const variant = await createProductVariant(container, product.id, options.variant)

  const price = generateCreatePriceDTO(options.price)
  const [priceSet] = await priceVariants(container, [variant.id], { prices: [price] })
  if (!priceSet) throw new Error('priceVariants returned no rows')

  const stock =
    options.inventory === null ? null : await stockVariant(container, { ...options.inventory, variantId: variant.id })

  return {
    product,
    variant,
    price,
    priceSet,
    inventoryItem: stock?.inventoryItem ?? null,
    inventoryLevel: stock?.inventoryLevel ?? null,
  }
}
