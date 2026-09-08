import { test } from '@tests/setup/test-extend.js'
import { buildCascadeGraph } from '../../core/db/cascade-graph.js'
import { createWithTransaction } from '../../core/utils/with-transaction.js'
import * as models from '../definitions/index.js'
import { CartPaymentCollectionRepository } from '../repositories/cart-payment-collection.js'
import { CartProductRepository } from '../repositories/cart-product.js'
import { OrderCartRepository } from '../repositories/order-cart.js'
import { OrderFulfillmentRepository } from '../repositories/order-fulfillment.js'
import { OrderPaymentCollectionRepository } from '../repositories/order-payment-collection.js'
import { ProductVariantInventoryItemRepository } from '../repositories/product-variant-inventory-item.js'
import { ProductVariantPriceSetRepository } from '../repositories/product-variant-price-set.js'
import { RegionPaymentProviderRepository } from '../repositories/region-payment-provider.js'
import { LinkService } from '../services/link-service.js'

const cascadeGraph = buildCascadeGraph(models)

let linkService: LinkService
let productVariantPriceSet: ProductVariantPriceSetRepository
let productVariantInventoryItem: ProductVariantInventoryItemRepository
let cartPaymentCollection: CartPaymentCollectionRepository

test.beforeEach(({ getDb }) => {
  productVariantPriceSet = new ProductVariantPriceSetRepository({ getDb, cascadeGraph })
  productVariantInventoryItem = new ProductVariantInventoryItemRepository({ getDb, cascadeGraph })
  cartPaymentCollection = new CartPaymentCollectionRepository({ getDb, cascadeGraph })
  const cartProduct = new CartProductRepository({ getDb })
  const orderCart = new OrderCartRepository({ getDb, cascadeGraph })
  const orderPaymentCollection = new OrderPaymentCollectionRepository({ getDb, cascadeGraph })
  const orderFulfillment = new OrderFulfillmentRepository({ getDb, cascadeGraph })
  const regionPaymentProvider = new RegionPaymentProviderRepository({ getDb, cascadeGraph })

  linkService = new LinkService({
    withTransaction: createWithTransaction(getDb),
    productVariantPriceSet,
    productVariantInventoryItem,
    cartPaymentCollection,
    cartProduct,
    orderCart,
    orderPaymentCollection,
    orderFulfillment,
    regionPaymentProvider,
  })
})

test.describe('LinkService.dismissLinks', () => {
  test('dismisses variant links from both price set and inventory item repos', async ({ expect }) => {
    const pvps = await productVariantPriceSet.create({ variantId: 'var_1', priceSetId: 'pset_1' })
    const pvii = await productVariantInventoryItem.create({ variantId: 'var_1', inventoryItemId: 'inv_1' })

    const result = await linkService.dismissLinks({ variantId: ['var_1'] })

    expect(result.productVariantPriceSet).toHaveLength(1)
    expect(result.productVariantPriceSet?.[0]?.id).toBe(pvps.id)
    expect(result.productVariantInventoryItem).toHaveLength(1)
    expect(result.productVariantInventoryItem?.[0]?.id).toBe(pvii.id)
  })

  test('soft-deletes records (sets deletedAt, does not hard-delete)', async ({ expect }) => {
    const pvps = await productVariantPriceSet.create({ variantId: 'var_2', priceSetId: 'pset_2' })

    await linkService.dismissLinks({ variantId: ['var_2'] })

    const active = await productVariantPriceSet.findById(pvps.id)
    expect(active).toBeNull()

    const withDeleted = await productVariantPriceSet.findById(pvps.id, { withDeleted: true })
    expect(withDeleted).not.toBeNull()
    expect(withDeleted?.deletedAt).toBeInstanceOf(Date)
  })

  test('returns empty result when no records match', async ({ expect }) => {
    const result = await linkService.dismissLinks({ variantId: ['var_nonexistent'] })

    expect(result.productVariantPriceSet).toBeUndefined()
    expect(result.productVariantInventoryItem).toBeUndefined()
  })

  test('only dismisses matching records, leaves others untouched', async ({ expect }) => {
    await productVariantPriceSet.create({ variantId: 'var_keep', priceSetId: 'pset_keep' })
    await productVariantPriceSet.create({ variantId: 'var_dismiss', priceSetId: 'pset_dismiss' })

    await linkService.dismissLinks({ variantId: ['var_dismiss'] })

    const remaining = await productVariantPriceSet.find({ variantId: 'var_keep' })
    expect(remaining).toHaveLength(1)

    const dismissed = await productVariantPriceSet.find({ variantId: 'var_dismiss' })
    expect(dismissed).toHaveLength(0)
  })

  test('dismisses by cartId from cart payment collection repo', async ({ expect }) => {
    const cpc = await cartPaymentCollection.create({ cartId: 'cart_1', paymentCollectionId: 'paycol_1' })

    const result = await linkService.dismissLinks({ cartId: ['cart_1'] })

    expect(result.cartPaymentCollection).toHaveLength(1)
    expect(result.cartPaymentCollection?.[0]?.id).toBe(cpc.id)
  })

  test('dismisses across multiple columns in a single call', async ({ expect }) => {
    const pvps = await productVariantPriceSet.create({ variantId: 'var_multi', priceSetId: 'pset_multi' })
    const cpc = await cartPaymentCollection.create({ cartId: 'cart_multi', paymentCollectionId: 'paycol_multi' })

    const result = await linkService.dismissLinks({
      variantId: ['var_multi'],
      cartId: ['cart_multi'],
    })

    expect(result.productVariantPriceSet).toHaveLength(1)
    expect(result.productVariantPriceSet?.[0]?.id).toBe(pvps.id)
    expect(result.cartPaymentCollection).toHaveLength(1)
    expect(result.cartPaymentCollection?.[0]?.id).toBe(cpc.id)
  })

  test('dismisses multiple records for the same column', async ({ expect }) => {
    const pvps1 = await productVariantPriceSet.create({ variantId: 'var_batch_1', priceSetId: 'pset_b1' })
    const pvps2 = await productVariantPriceSet.create({ variantId: 'var_batch_2', priceSetId: 'pset_b2' })

    const result = await linkService.dismissLinks({ variantId: ['var_batch_1', 'var_batch_2'] })

    expect(result.productVariantPriceSet).toHaveLength(2)
    const ids = result.productVariantPriceSet?.map((r) => r.id)
    expect(ids).toContain(pvps1.id)
    expect(ids).toContain(pvps2.id)
  })
})
