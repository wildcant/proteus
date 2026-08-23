import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createSimpleWorkflowEngine } from '@core/workflows/simple-adapter.js'
import { setWorkflowEngine } from '@core/workflows/types.js'
import { test } from '@tests/setup/test-extend.js'
import { asValue, createContainer } from 'awilix'
import { vi } from 'vitest'
import { setProductOptionsWorkflow } from '../set-product-options.js'

const PRODUCT_ID = 'prod_1'
const SIZE = 'opt_size'
const COLOR = 'opt_color'
const KEPT = 'variant_kept'
const DOOMED = 'variant_doomed'

const combination = (label: string, optionValues: Record<string, string>) => ({
  key: label,
  label,
  values: [],
  optionValues,
  variantId: null,
})

type PlanOverrides = Partial<{
  keep: unknown[]
  reassign: unknown[]
  create: unknown[]
  remove: unknown[]
}>

function setup(plan: PlanOverrides, options?: { lineItems?: Array<{ id: string; cartId: string }>; carts?: string[] }) {
  const productService = {
    // Values, so the options being restored differ from the ones being written — otherwise the
    // compensation assertion below would pass against the forward call.
    listProductOptionsForProduct: vi
      .fn()
      .mockResolvedValue([{ id: SIZE, title: 'Size', values: [{ id: 'v_s' }, { id: 'v_m' }] }]),
    listProductVariants: vi.fn().mockResolvedValue([{ id: KEPT, productId: PRODUCT_ID }]),
    listVariantOptionMaps: vi.fn().mockResolvedValue({ [KEPT]: { [SIZE]: 'v_s' } }),
    planProductOptionChange: vi.fn().mockResolvedValue({ keep: [], reassign: [], create: [], remove: [], ...plan }),
    setProductOptions: vi.fn().mockResolvedValue(undefined),
    applyVariantReassignments: vi.fn().mockResolvedValue(undefined),
    createProductVariants: vi.fn().mockResolvedValue([{ id: 'variant_new', productId: PRODUCT_ID }]),
    deleteProductVariants: vi.fn().mockResolvedValue(undefined),
  }

  const priceSetRepository = { findByVariantIds: vi.fn().mockResolvedValue([]), create: vi.fn() }
  const linkService = {
    repo: vi.fn().mockReturnValue(priceSetRepository),
    dismissLinks: vi.fn().mockResolvedValue({ productVariantPriceSet: [{ priceSetId: 'pset_gone' }] }),
  }
  const pricingService = {
    listPrices: vi.fn().mockResolvedValue([]),
    createPriceSets: vi.fn().mockResolvedValue([{ id: 'pset_new' }]),
    deletePriceSets: vi.fn().mockResolvedValue(undefined),
  }
  const cartService = {
    listLineItems: vi.fn().mockResolvedValue(options?.lineItems ?? []),
    listCarts: vi.fn().mockResolvedValue((options?.carts ?? []).map((id) => ({ id }))),
    deleteLineItems: vi.fn().mockResolvedValue(undefined),
  }

  const container = createContainer()
  container.register({
    [Modules.PRODUCT]: asValue(productService),
    [Modules.PRICING]: asValue(pricingService),
    [Modules.CART]: asValue(cartService),
    [ContainerRegistrationKeys.LINK]: asValue(linkService),
  })
  setWorkflowEngine(createSimpleWorkflowEngine(), container)

  return { productService, linkService, pricingService, cartService, priceSetRepository }
}

const run = () =>
  setProductOptionsWorkflow.run({ productId: PRODUCT_ID, data: { options: [{ optionId: SIZE, valueIds: [] }] } })

test.describe('setProductOptionsWorkflow', () => {
  test('creates the combinations nothing covers yet', async ({ expect }) => {
    const { productService } = setup({
      create: [
        { combination: combination('M / White', { [SIZE]: 'v_m', [COLOR]: 'v_w' }), copyPricesFromVariantId: null },
      ],
    })

    await run()

    expect(productService.createProductVariants).toHaveBeenCalledWith([
      { productId: PRODUCT_ID, optionValues: { [SIZE]: 'v_m', [COLOR]: 'v_w' } },
    ])
  })

  test('copies the nearest survivor prices onto a created variant', async ({ expect }) => {
    const { pricingService, priceSetRepository } = setup({
      create: [{ combination: combination('M / White', { [SIZE]: 'v_m' }), copyPricesFromVariantId: KEPT }],
    })
    priceSetRepository.findByVariantIds.mockResolvedValue([{ variantId: KEPT, priceSetId: 'pset_source' }])
    pricingService.listPrices.mockResolvedValue([{ currencyCode: 'usd', amount: 2800 }])

    await run()

    expect(pricingService.createPriceSets).toHaveBeenCalledWith([{ prices: [{ currencyCode: 'usd', amount: 2800 }] }])
    expect(priceSetRepository.create).toHaveBeenCalledWith({ variantId: 'variant_new', priceSetId: 'pset_new' })
  })

  test('a removed variant takes its price set and links with it', async ({ expect }) => {
    const { productService, linkService, pricingService } = setup({
      remove: [{ variantId: DOOMED, title: 'S / Red', reason: 'value-dropped' }],
    })

    await run()

    expect(linkService.dismissLinks).toHaveBeenCalledWith({ variantId: [DOOMED] })
    expect(pricingService.deletePriceSets).toHaveBeenCalledWith(['pset_gone'])
    expect(productService.deleteProductVariants).toHaveBeenCalledWith([DOOMED])
  })

  test('a removed variant is evicted from active carts only', async ({ expect }) => {
    // A completed cart is the record behind an order; rewriting it would rewrite history.
    const { cartService } = setup(
      { remove: [{ variantId: DOOMED, title: 'S / Red', reason: 'collapsed' }] },
      {
        lineItems: [
          { id: 'li_active', cartId: 'cart_active' },
          { id: 'li_completed', cartId: 'cart_completed' },
        ],
        carts: ['cart_active'],
      },
    )

    await run()

    expect(cartService.listCarts).toHaveBeenCalledWith({ id: ['cart_active', 'cart_completed'], status: 'active' })
    expect(cartService.deleteLineItems).toHaveBeenCalledWith(['li_active'])
  })

  test('nothing to remove leaves the cart alone', async ({ expect }) => {
    const { cartService, linkService } = setup({})

    await run()

    expect(cartService.listLineItems).not.toHaveBeenCalled()
    expect(linkService.dismissLinks).not.toHaveBeenCalled()
  })

  test('a failure after the options are written puts them back', async ({ expect }) => {
    const { productService } = setup({
      // Lands somewhere other than where it started, so restoring it is observably different.
      reassign: [{ variantId: KEPT, fromLabel: 'S', combination: combination('M / White', { [SIZE]: 'v_m' }) }],
      create: [{ combination: combination('M / White', { [SIZE]: 'v_m' }), copyPricesFromVariantId: null }],
    })
    productService.createProductVariants.mockRejectedValue(new Error('SKU collision'))

    await expect(run()).rejects.toThrow()

    // The prior option set, read before anything was written.
    expect(productService.setProductOptions).toHaveBeenLastCalledWith(PRODUCT_ID, {
      options: [{ optionId: SIZE, valueIds: ['v_s', 'v_m'] }],
    })
    expect(productService.applyVariantReassignments).toHaveBeenLastCalledWith([
      { variantId: KEPT, optionValues: { [SIZE]: 'v_s' } },
    ])
  })
})
