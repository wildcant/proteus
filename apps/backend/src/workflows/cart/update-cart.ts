import type { BigNumber } from '@core/bignumber.js'
import { ErrorTypes } from '@core/errors/app-error.js'
import type { CartDTO } from '@core/types/cart/common.js'
import type { ICartModuleService } from '@core/types/cart/service.js'
import type { IFulfillmentModuleService } from '@core/types/fulfillment/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { IPaymentModuleService } from '@core/types/payment/service.js'
import type { IPricingModuleService } from '@core/types/pricing/service.js'
import type { RegionDTO } from '@core/types/region/common.js'
import type { IRegionModuleService } from '@core/types/region/service.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import type { UpdateCartBody } from '@proteus/http-schemas/store'
import { buildVariantPrices } from '../product/utils/build-variant-prices.js'
import { findOrCreateCustomerStep } from './steps/find-or-create-customer.js'
import { isShopperEnteredAddress } from './utils/shipping-address-country.js'

type UpdateCartInput = UpdateCartBody & {
  cartId: string
}

/**
 * Everything a market switch decided before anything was written, so the steps that carry it out
 * do not each re-derive it — and so a switch that cannot be honoured is refused before the first
 * write rather than half-way through.
 */
type RegionChange = {
  regionId: string
  /** The region's currency. Every line item, shipping method and payment is settled in it. */
  currencyCode: string
  /**
   * Which country the refreshed shipping methods are quoted for, resolved the way
   * `GET /store/carts/:id/shipping-options` resolves it: the shopper's own address wins, and a
   * cart that has not reached the address step falls back to the region's first country by code.
   * Null when the new region sells to no country at all, which offers nothing.
   */
  shippingCountryCode: string | null
  /**
   * The country the change writes onto the cart's shipping address, set only when the new region
   * covers exactly one country and the cart names none. With one country there is nothing to
   * choose between, so the market answers the question the shopper has not been asked yet.
   */
  adoptedCountryCode: string | null
  /**
   * A shipping address holding only a country a previous switch adopted, which the new market does
   * not sell to and cannot replace because it covers more than one country. It is removed rather
   * than left: a country nobody chose, outside the market the cart is now in, would go on quoting
   * another market's shipping rates.
   */
  staleShippingAddressId: string | null
}

/** What `apply-region-change` has to put back, and the cart as the switch left it. */
type AppliedRegionChange = {
  cart: CartDTO
  previousRegionId: string | null
  previousCurrencyCode: string
  /** The shipping address row the adopted country created, so compensation can remove it again. */
  createdShippingAddressId: string | null
  /** The country the adopted one overwrote on an address that already existed. */
  overwrittenShippingAddress: { id: string; countryCode: string | null } | null
  /** The stale adopted address the switch removed, so compensation can bring it back. */
  removedShippingAddressId: string | null
}

/** One line item's price before the switch — the whole of what repricing has to undo. */
type PreviousLineItemPrice = { id: string; unitPrice: BigNumber }

/** The payment collection's terms before the switch, or null when the cart has none yet. */
type PreviousPaymentCollection = { id: string; amount: BigNumber; currencyCode: string } | null

/**
 * The market a switch names, however the caller named it — or null when it named none.
 *
 * Two spellings for one question, because two callers hold different halves of the answer. A
 * server-side caller has the region id and passes it. The storefront has only the country segment
 * in its own URL, by design: it sends the market it already knows and the region and its currency
 * are resolved here, in the one place that owns what a market means.
 */
async function resolveNamedRegion(
  regionService: IRegionModuleService,
  named: { regionId?: string; countryCode?: string },
): Promise<RegionDTO | null> {
  // Retrieving rather than listing, so an id naming no region is a 404 instead of a cart quietly
  // repriced into nothing.
  if (named.regionId) return regionService.retrieveRegion(named.regionId)
  if (!named.countryCode) return null

  const countryCode = named.countryCode.toLowerCase()
  // One read for both failures, the way the pricing middleware reads the same input: an unknown
  // ISO code and a country outside every region are the same answer to a storefront, which only
  // offers the countries `GET /store/countries` lists.
  const [country] = await regionService.listCountries({ id: countryCode })
  if (!country?.regionId) {
    throw new WorkflowTerminalError({
      type: ErrorTypes.INVALID_DATA,
      message: `No region sells to country "${countryCode}"`,
    })
  }

  return regionService.retrieveRegion(country.regionId)
}

export const updateCartWorkflow = createWorkflow<UpdateCartInput, CartDTO>('update-cart', async (ctx, input) => {
  /**
   * Validates the cart exists and hasn't been completed. A completed cart is the record behind
   * an order and must not accept further updates.
   */
  const cart = await ctx.step('validate-cart', async ({ container }) => {
    const cartService = container.resolve<ICartModuleService>(Modules.CART)
    const cart = await cartService.retrieveCart(input.cartId)

    if (cart.completedAt) {
      throw new WorkflowTerminalError({
        type: ErrorTypes.NOT_ALLOWED,
        message: `Cart "${input.cartId}" is already completed`,
      })
    }

    return cart
  })

  /**
   * Reads the new market and decides whether the cart can move to it — before the customer is
   * created and before a single column is written, so a refusal leaves the cart exactly as the
   * shopper left it.
   *
   * A region the cart is already in is not a change: the switch would reprice every line at the
   * same numbers and drop shipping methods that still apply, for nothing.
   */
  const regionChange = await ctx.step<RegionChange | null>('resolve-region-change', async ({ container }) => {
    const regionService = container.resolve<IRegionModuleService>(Modules.REGION)
    const cartService = container.resolve<ICartModuleService>(Modules.CART)

    const region = await resolveNamedRegion(regionService, input)
    if (!region || region.id === cart.regionId) return null

    const countries = await regionService.listCountries({ regionId: region.id }, { order: { id: 'ASC' } })
    const countryCodes = countries.map((country) => country.id)

    const [existingShippingAddress] = await cartService.listCartAddresses({
      cartId: input.cartId,
      type: 'shipping',
    })

    // Where the shopper said the order goes. The payload's address outranks the row on the cart,
    // which this same request is about to replace; a row carrying nothing but a country an earlier
    // switch adopted is not their answer at all — `isShopperEnteredAddress` says why.
    const shopperAddress =
      input.shippingAddress ??
      (existingShippingAddress && isShopperEnteredAddress(existingShippingAddress)
        ? existingShippingAddress
        : undefined)
    const enteredCountry = shopperAddress?.countryCode?.toLowerCase()

    /** The country an earlier switch adopted, still on the cart and not being replaced. */
    const adoptedAddress = !shopperAddress && existingShippingAddress ? existingShippingAddress : null

    // Cross-border shipping does not exist yet: a market sells to the countries it lists, so an
    // address the shopper gave outside them is an order the new market could not fulfil. Refusing
    // beats silently moving their address to a country they did not choose.
    if (enteredCountry && !countryCodes.includes(enteredCountry)) {
      throw new WorkflowTerminalError({
        type: ErrorTypes.INVALID_DATA,
        message: `"${region.name}" does not ship to "${enteredCountry}"`,
      })
    }

    const [firstCountryCode] = countryCodes
    const adoptedCountryCode = !enteredCountry && countryCodes.length === 1 ? (firstCountryCode ?? null) : null
    const adoptedCountryIsStale =
      adoptedAddress?.countryCode != null && !countryCodes.includes(adoptedAddress.countryCode.toLowerCase())

    return {
      regionId: region.id,
      currencyCode: region.currencyCode,
      shippingCountryCode: enteredCountry ?? adoptedCountryCode ?? firstCountryCode ?? null,
      adoptedCountryCode,
      staleShippingAddressId: !adoptedCountryCode && adoptedCountryIsStale ? (adoptedAddress?.id ?? null) : null,
    }
  })

  /**
   * When a guest provides an email, find or create a guest customer record
   * and link it to the cart so the order inherits a customerId.
   */
  const { customer } = await findOrCreateCustomerStep(ctx, {
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
  })

  /**
   * Links the guest customer to the cart, then upserts addresses and email
   * in a single transaction.
   */
  const updatedCart = await ctx.step('update-cart', async ({ container }) => {
    const cartService = container.resolve<ICartModuleService>(Modules.CART)

    if (customer) {
      await cartService.updateCart(input.cartId, { customerId: customer.id, email: customer.email })
    }

    return cartService.updateCartWithAddresses(input.cartId, {
      email: input.email,
      shippingAddress: input.shippingAddress,
      billingAddress: input.billingAddress,
    })
  })

  if (!regionChange) return updatedCart

  /**
   * Moves the cart into the new market: its region, the currency that region settles in, and —
   * when the market has exactly one country — the country its shipping address ships to.
   *
   * The currency is written here rather than taken from the payload for the same reason the
   * region is: it is the region's to decide, and the three refreshes below all read it back off
   * the cart, so there is one answer to what money this cart is in.
   */
  const applied = await ctx.step<AppliedRegionChange>(
    'apply-region-change',
    async ({ container }) => {
      const cartService = container.resolve<ICartModuleService>(Modules.CART)

      const [existingShippingAddress] = await cartService.listCartAddresses({
        cartId: input.cartId,
        type: 'shipping',
      })

      const cart = await cartService.updateCart(input.cartId, {
        regionId: regionChange.regionId,
        currencyCode: regionChange.currencyCode,
      })

      const unchangedAddress = {
        cart,
        previousRegionId: updatedCart.regionId,
        previousCurrencyCode: updatedCart.currencyCode,
        createdShippingAddressId: null,
        overwrittenShippingAddress: null,
        removedShippingAddressId: null,
      }

      if (regionChange.staleShippingAddressId) {
        await cartService.softDeleteCartAddresses([regionChange.staleShippingAddressId])
        return { ...unchangedAddress, removedShippingAddressId: regionChange.staleShippingAddressId }
      }

      if (!regionChange.adoptedCountryCode) return unchangedAddress

      const shippingAddress = await cartService.upsertCartAddress(input.cartId, 'shipping', {
        countryCode: regionChange.adoptedCountryCode,
      })

      return {
        ...unchangedAddress,
        createdShippingAddressId: existingShippingAddress ? null : shippingAddress.id,
        overwrittenShippingAddress: existingShippingAddress
          ? { id: existingShippingAddress.id, countryCode: existingShippingAddress.countryCode }
          : null,
      }
    },
    async (applied, { container }) => {
      const cartService = container.resolve<ICartModuleService>(Modules.CART)

      await cartService.updateCart(input.cartId, {
        regionId: applied.previousRegionId,
        currencyCode: applied.previousCurrencyCode,
      })

      if (applied.createdShippingAddressId) {
        await cartService.softDeleteCartAddresses([applied.createdShippingAddressId])
      }

      if (applied.overwrittenShippingAddress) {
        await cartService.upsertCartAddress(input.cartId, 'shipping', {
          countryCode: applied.overwrittenShippingAddress.countryCode,
        })
      }

      if (applied.removedShippingAddressId) {
        await cartService.restoreCartAddresses([applied.removedShippingAddressId])
      }
    },
  )

  /**
   * Reprices every line at what the catalogue asks in the new market's currency.
   *
   * A line the catalogue cannot price there fails the whole update, by name. The alternatives are
   * both worse than a refusal a shopper can read: dropping the line loses something they chose
   * without saying so, and leaving its old number puts two currencies in one basket and bills the
   * larger of them.
   *
   * Every price is resolved before anything is written, so the refusal happens with the cart
   * untouched rather than half repriced. The writes then land in one transaction, which is what
   * keeps the cart out of the mixed-currency state this step exists to prevent.
   */
  await ctx.step<PreviousLineItemPrice[]>(
    'reprice-line-items',
    async ({ container }) => {
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      const pricingService = container.resolve<IPricingModuleService>(Modules.PRICING)
      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

      const lineItems = await cartService.listLineItems({ cartId: input.cartId })
      if (lineItems.length === 0) return []

      const variantIds = [...new Set(lineItems.flatMap((item) => (item.variantId ? [item.variantId] : [])))]
      const links = await linkService.repo('productVariantPriceSet').findByVariantIds(variantIds)
      const priceSetIds = [...new Set(links.map((link) => link.priceSetId))]
      const calculatedPrices = await pricingService.calculatePrices(priceSetIds, {
        currencyCode: regionChange.currencyCode,
      })
      const priceByVariantId = buildVariantPrices(links, calculatedPrices)

      const repriced = lineItems.map((item) => {
        const price = item.variantId ? priceByVariantId.get(item.variantId) : undefined
        if (!price) {
          throw new WorkflowTerminalError({
            type: ErrorTypes.INVALID_DATA,
            message: `"${item.title}" is not sold in ${regionChange.currencyCode.toUpperCase()}`,
          })
        }

        return { id: item.id, unitPrice: price.calculatedAmount, previousUnitPrice: item.unitPrice }
      })

      await cartService.applyLineItemPlan(input.cartId, {
        create: [],
        merge: repriced.map(({ id, unitPrice }) => ({ id, data: { unitPrice } })),
      })

      return repriced.map(({ id, previousUnitPrice }) => ({ id, unitPrice: previousUnitPrice }))
    },
    async (previousPrices, { container }) => {
      if (previousPrices.length === 0) return
      const cartService = container.resolve<ICartModuleService>(Modules.CART)

      await cartService.applyLineItemPlan(input.cartId, {
        create: [],
        merge: previousPrices.map(({ id, unitPrice }) => ({ id, data: { unitPrice } })),
      })
    },
  )

  /**
   * Drops the shipping methods the new market does not offer.
   *
   * A method is a quote for a rate in a zone, so one whose option the new country is outside of is
   * not a cheaper or dearer quote — it is a delivery nobody is offering. It is removed rather than
   * repriced, which leaves the shopper to choose again from the options the new market does list.
   */
  await ctx.step<string[]>(
    'refresh-shipping-methods',
    async ({ container }) => {
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      const fulfillmentService = container.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)

      const shippingMethods = await cartService.listShippingMethods({ cartId: input.cartId })
      if (shippingMethods.length === 0) return []

      const offered = regionChange.shippingCountryCode
        ? await fulfillmentService.listShippingOptionsForContext({ countryCode: regionChange.shippingCountryCode })
        : []
      const offeredIds = new Set(offered.map((option) => option.id))

      // A method with no option behind it cannot be shown to still apply, so it goes with the
      // rest — the cart is left offering only deliveries the new market answers for.
      const stale = shippingMethods.filter(
        (method) => !method.shippingOptionId || !offeredIds.has(method.shippingOptionId),
      )
      if (stale.length === 0) return []

      const staleIds = stale.map((method) => method.id)
      await cartService.softDeleteShippingMethods(staleIds)

      return staleIds
    },
    async (staleIds, { container }) => {
      if (staleIds.length === 0) return
      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      await cartService.restoreShippingMethods(staleIds)
    },
  )

  /**
   * Restates the amount to authorise in the money the cart now quotes.
   *
   * Last, because it totals what the two steps above just rewrote. A cart with no collection yet
   * has nothing to restate — checkout creates one from the current total when it gets there.
   */
  await ctx.step<PreviousPaymentCollection>(
    'refresh-payment-collection',
    async ({ container }) => {
      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

      const link = await linkService.repo('cartPaymentCollection').findByCartId(input.cartId)
      if (!link) return null

      const cartService = container.resolve<ICartModuleService>(Modules.CART)
      const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)

      const [collection, lineItems, shippingMethods] = await Promise.all([
        paymentService.retrievePaymentCollection(link.paymentCollectionId),
        cartService.listLineItems({ cartId: input.cartId }),
        cartService.listShippingMethods({ cartId: input.cartId }),
      ])

      const { cartTotal } = cartService.computeCartTotals({ lineItems, shippingMethods })

      await paymentService.updatePaymentCollection(collection.id, {
        amount: cartTotal,
        currencyCode: regionChange.currencyCode,
      })

      return { id: collection.id, amount: collection.amount, currencyCode: collection.currencyCode }
    },
    async (previous, { container }) => {
      if (!previous) return
      const paymentService = container.resolve<IPaymentModuleService>(Modules.PAYMENT)

      await paymentService.updatePaymentCollection(previous.id, {
        amount: previous.amount,
        currencyCode: previous.currencyCode,
      })
    },
  )

  return applied.cart
})
