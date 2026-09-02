import type { AwilixContainer } from 'awilix'
import { ulid } from 'ulid'
import { BigNumber } from '../../src/core/db/bignum.js'
import { addCartAddresses, addLineItem, addShippingMethod, createCart } from '../../tests/factories/services/cart.js'
import { createSellableVariant } from '../../tests/factories/services/checkout.js'
import { createPaymentSessionForCart } from '../../tests/factories/services/payment.js'

/**
 * A cart that `complete-cart` will take all the way through, with as many line items as asked for.
 *
 * Built from `tests/factories/` rather than a second copy of the same graph. Both scripts here need
 * a checkout a workflow can actually complete — a variant, a price, stock, a shipping method, an
 * email, addresses and a processable payment session — and that graph already exists, is already
 * exercised by the whole backend suite, and moves whenever the modules do. A private copy in `scripts/` would
 * be the thing that silently stops matching what checkout requires.
 *
 * The line-item count is the reason this is not just `createCheckoutReadyCart`: the payload
 * measurement is about a cart with a realistic number of items, and each one needs its own sellable,
 * stocked variant or `reserve-inventory` has nothing to reserve.
 */
export async function seedCheckoutCart(
  container: AwilixContainer,
  options: { lineItems: number; quantity?: number },
): Promise<{ cartId: string; lineItems: number }> {
  const quantity = options.quantity ?? 2

  const cart = await createCart(container, { email: 'payload-measurement@example.com', currencyCode: 'usd' })
  await addCartAddresses(container, cart.id)

  let total = new BigNumber(0)

  for (let index = 0; index < options.lineItems; index += 1) {
    const { variant } = await createSellableVariant(container, {
      // Handles are unique and faker's word list is not: a 50-item cart collides with itself, and
      // this script is meant to be run repeatedly against the same database.
      product: { handle: `payload-fixture-${ulid().toLowerCase()}` },
      // Exactly what this cart orders, so the reservation succeeds whatever the generator picked.
      inventory: { level: { stockedQuantity: quantity } },
    })

    const lineItem = await addLineItem(container, cart.id, { variantId: variant.id, quantity })
    total = total.plus(new BigNumber(Number(lineItem.unitPrice) * lineItem.quantity))
  }

  const shippingMethod = await addShippingMethod(container, cart.id)
  total = total.plus(new BigNumber(Number(shippingMethod.amount)))

  await createPaymentSessionForCart(container, { cartId: cart.id, amount: total, currencyCode: cart.currencyCode })

  return { cartId: cart.id, lineItems: options.lineItems }
}
