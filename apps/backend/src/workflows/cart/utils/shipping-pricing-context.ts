import type { CartAddressDTO, CartDTO, CartLineItemDTO } from '@core/types/cart/common.js'
import type { CalculateShippingPriceContext } from '@core/types/fulfillment/provider.js'
import type { ProductVariantDTO } from '@core/types/product/common.js'

type ShippingPricingSources = {
  cart: Pick<CartDTO, 'id' | 'currencyCode'>
  shippingAddress: CartAddressDTO | null
  /**
   * The cart's region's first country by code, the stand-in for an address not entered yet —
   * read only when the address names no country. See `GET /store/carts/:id/shipping-options`.
   */
  regionCountryCode: string | null
  lineItems: CartLineItemDTO[]
  variants: Pick<ProductVariantDTO, 'id' | 'weight' | 'length' | 'height' | 'width'>[]
}

/**
 * A cart as the fulfillment module prices shipping for it: where it goes, what is in it with each
 * variant's weight and dimensions, and its currency. Null when the cart has no country to ship to
 * at all, which nothing can be quoted for.
 */
export function buildShippingPricingContext({
  cart,
  shippingAddress,
  regionCountryCode,
  lineItems,
  variants,
}: ShippingPricingSources): CalculateShippingPriceContext | null {
  const countryCode = shippingAddress?.countryCode?.toLowerCase() ?? regionCountryCode
  if (!countryCode) return null

  const variantById = new Map(variants.map((variant) => [variant.id, variant]))

  return {
    cartId: cart.id,
    currencyCode: cart.currencyCode,
    shippingAddress: {
      countryCode,
      province: shippingAddress?.province,
      city: shippingAddress?.city,
      postalCode: shippingAddress?.postalCode,
      address1: shippingAddress?.address1,
      address2: shippingAddress?.address2,
      company: shippingAddress?.company,
      firstName: shippingAddress?.firstName,
      lastName: shippingAddress?.lastName,
      phone: shippingAddress?.phone,
    },
    items: lineItems.map((item) => {
      const variant = item.variantId ? variantById.get(item.variantId) : undefined
      return {
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        variantId: item.variantId,
        variant: variant
          ? {
              id: variant.id,
              weight: variant.weight,
              length: variant.length,
              height: variant.height,
              width: variant.width,
            }
          : null,
      }
    }),
  }
}
