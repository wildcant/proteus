import type { BigNumber } from '@core/bignumber.js'
import type { CalculateShippingPriceContext } from '@core/types/fulfillment/provider.js'
import type { ProductVariantDTO } from '@core/types/product/common.js'

/** An address as shipping is priced from it. Structural, because a Cart's and an Order's both are. */
type ShippingAddressSource = {
  countryCode: string | null
  province: string | null
  city: string | null
  postalCode: string | null
  address1: string | null
  address2: string | null
  company: string | null
  firstName: string | null
  lastName: string | null
  phone: string | null
}

/** A line as shipping is priced from it, a Cart's or a Draft Order's. */
type ShippingLineItemSource = {
  id: string
  title: string
  quantity: number
  unitPrice: BigNumber
  variantId: string | null
}

type ShippingPricingSources = {
  /** The Cart being priced; null for a Draft Order, which has no open Cart behind it any more. */
  cartId: string | null
  currencyCode: string
  shippingAddress: ShippingAddressSource | null
  /**
   * The cart's region's first country by code, the stand-in for an address not entered yet —
   * read only when the address names no country. See `GET /store/carts/:id/shipping-options`.
   */
  regionCountryCode: string | null
  lineItems: ShippingLineItemSource[]
  variants: Pick<ProductVariantDTO, 'id' | 'weight' | 'length' | 'height' | 'width'>[]
}

/**
 * A Cart or a Draft Order as the fulfillment module prices shipping for it: where it goes, what is
 * in it with each variant's weight and dimensions, and its currency. Null when it has no country to
 * ship to at all, which nothing can be quoted for.
 */
export function buildShippingPricingContext({
  cartId,
  currencyCode,
  shippingAddress,
  regionCountryCode,
  lineItems,
  variants,
}: ShippingPricingSources): CalculateShippingPriceContext | null {
  const countryCode = shippingAddress?.countryCode?.toLowerCase() ?? regionCountryCode
  if (!countryCode) return null

  const variantById = new Map(variants.map((variant) => [variant.id, variant]))

  return {
    cartId,
    currencyCode,
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
