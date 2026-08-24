import { type AwilixContainer, asValue } from 'awilix'
import { buildCascadeGraph } from '../core/db/cascade-graph.js'
import type { DbProvider } from '../core/db/ports.js'
import { ContainerRegistrationKeys } from '../core/utils/index.js'
import { createWithTransaction } from '../core/utils/with-transaction.js'
import * as definitions from './definitions/index.js'
import { CartPaymentCollectionRepository } from './repositories/cart-payment-collection.js'
import { CartProductRepository } from './repositories/cart-product.js'
import { OrderCartRepository } from './repositories/order-cart.js'
import { OrderFulfillmentRepository } from './repositories/order-fulfillment.js'
import { OrderPaymentCollectionRepository } from './repositories/order-payment-collection.js'
import { ProductVariantInventoryItemRepository } from './repositories/product-variant-inventory-item.js'
import { ProductVariantPriceSetRepository } from './repositories/product-variant-price-set.js'
import { LinkService } from './services/link-service.js'

export function registerLinkService(sharedContainer: AwilixContainer): void {
  const dbProvider: DbProvider = sharedContainer.resolve(ContainerRegistrationKeys.DB_PROVIDER)
  const getDb = dbProvider.getDb.bind(dbProvider)
  // Empty in practice — a link table declares no foreign keys, because a link's whole point is to
  // join across modules where the database cannot. Built from the definitions anyway, so the day
  // one of them gains an owned child the cascade covers it without anybody wiring it up.
  const cascadeGraph = buildCascadeGraph(definitions)

  const productVariantInventoryItem = new ProductVariantInventoryItemRepository({ getDb, cascadeGraph })
  const cartProduct = new CartProductRepository({ getDb })
  const cartPaymentCollection = new CartPaymentCollectionRepository({ getDb, cascadeGraph })
  const productVariantPriceSet = new ProductVariantPriceSetRepository({ getDb, cascadeGraph })
  const orderCart = new OrderCartRepository({ getDb, cascadeGraph })
  const orderPaymentCollection = new OrderPaymentCollectionRepository({ getDb, cascadeGraph })
  const orderFulfillment = new OrderFulfillmentRepository({ getDb, cascadeGraph })

  const linkService = new LinkService({
    productVariantInventoryItem,
    cartProduct,
    cartPaymentCollection,
    productVariantPriceSet,
    orderCart,
    orderPaymentCollection,
    orderFulfillment,
    withTransaction: createWithTransaction(getDb),
  })

  sharedContainer.register({
    [ContainerRegistrationKeys.LINK]: asValue(linkService),
  })
}
