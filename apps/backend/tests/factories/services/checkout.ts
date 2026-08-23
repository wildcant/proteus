import type { AwilixContainer } from 'awilix'
import { BigNumber } from '../../../src/core/db/bignum.js'
import type {
  CreateCartDTO,
  CreateLineItemDTO,
  CreateShippingMethodDTO,
} from '../../../src/core/types/cart/mutations.js'
import { generateCreateLineItemDTO } from '../cart-dto.js'
import { addLineItem, addShippingMethod, createCart } from './cart.js'
import { type StockVariantOptions, stockVariant } from './inventory.js'
import { createPaymentSessionForCart } from './payment.js'

export type CreateCheckoutReadyCartOptions = {
  cart?: Partial<CreateCartDTO>
  lineItem?: Partial<CreateLineItemDTO>
  shippingMethod?: Partial<CreateShippingMethodDTO>
  /** Stock backing the line item's variant. `null` leaves the variant untracked, so
   *  `reserve-inventory` finds no mapping and reserves nothing. */
  inventory?: Omit<StockVariantOptions, 'variantId'> | null
  /** `null` leaves the cart without a payment collection, which `validate-cart-payments` rejects. */
  payment?: { providerId?: string } | null
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

  // A single unit by default, so a second reservation for this cart is an oversell.
  const inventory =
    options.inventory === null || !lineItem.variantId
      ? null
      : await stockVariant(container, {
          ...options.inventory,
          level: { stockedQuantity: 1, ...options.inventory?.level },
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
    total,
    variantId: lineItem.variantId,
    inventoryItem: inventory?.inventoryItem ?? null,
    inventoryLevel: inventory?.inventoryLevel ?? null,
    paymentCollection: payment?.paymentCollection ?? null,
    paymentSession: payment?.paymentSession ?? null,
  }
}
