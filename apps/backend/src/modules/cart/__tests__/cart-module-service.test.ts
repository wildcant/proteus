import { test } from '@tests/setup/test-extend.js'
import { buildCascadeGraph } from '../../../core/db/cascade-graph.js'
import { createWithTransaction } from '../../../core/utils/with-transaction.js'
import * as models from '../models/index.js'
import { CartRepository } from '../repositories/cart.js'
import { CartAddressRepository } from '../repositories/cart-address.js'
import { CartLineItemRepository } from '../repositories/cart-line-item.js'
import { CartShippingMethodRepository } from '../repositories/cart-shipping-method.js'
import { CartModuleService } from '../services/cart-module-service.js'

const cascadeGraph = buildCascadeGraph(models)

let service: CartModuleService

test.beforeEach(({ getDb, logger }) => {
  service = new CartModuleService({
    cartRepository: new CartRepository({ getDb, cascadeGraph }),
    cartAddressRepository: new CartAddressRepository({ getDb, cascadeGraph }),
    cartLineItemRepository: new CartLineItemRepository({ getDb, cascadeGraph }),
    cartShippingMethodRepository: new CartShippingMethodRepository({ getDb, cascadeGraph }),
    withTransaction: createWithTransaction(getDb),
    logger,
  })
})

test.describe('CartModuleService', () => {
  // ---------------------------------------------------------------------------
  // Cascade delete
  //
  // The cart module cascaded to nothing before the walker existed, so a "deleted" cart kept
  // returning its line items. These assert what a later read gives back, never how the walker
  // got there.
  // ---------------------------------------------------------------------------

  test.describe('Cascade delete', () => {
    test('softDeleteCarts — hides the cart line items', async ({ expect, dto }) => {
      const cart = await service.createCart(dto.generate.createCart())
      await service.addLineItems(cart.id, [dto.generate.createLineItem(), dto.generate.createLineItem()])

      await service.softDeleteCarts([cart.id])

      expect(await service.listLineItems({ cartId: cart.id })).toHaveLength(0)
    })

    test('softDeleteCarts — hides the cart shipping methods', async ({ expect, dto }) => {
      const cart = await service.createCart(dto.generate.createCart())
      await service.addShippingMethods(cart.id, [dto.generate.createShippingMethod()])

      await service.softDeleteCarts([cart.id])

      expect(await service.listShippingMethods({ cartId: cart.id })).toHaveLength(0)
    })

    test('restoreCarts — brings back the line items and shipping methods', async ({ expect, dto }) => {
      const cart = await service.createCart(dto.generate.createCart())
      await service.addLineItems(cart.id, [dto.generate.createLineItem(), dto.generate.createLineItem()])
      await service.addShippingMethods(cart.id, [dto.generate.createShippingMethod()])

      await service.softDeleteCarts([cart.id])
      await service.restoreCarts([cart.id])

      expect(await service.listCarts({ id: cart.id })).toHaveLength(1)
      expect(await service.listLineItems({ cartId: cart.id })).toHaveLength(2)
      expect(await service.listShippingMethods({ cartId: cart.id })).toHaveLength(1)
    })

    test('restoreCarts — leaves a line item that was deleted before the cascade', async ({ expect, dto }) => {
      const cart = await service.createCart(dto.generate.createCart())
      const [removed, kept] = await service.addLineItems(cart.id, [
        dto.generate.createLineItem(),
        dto.generate.createLineItem(),
      ])
      if (!removed || !kept) throw new Error('expected two line items')

      // Deleted for its own reasons, so it carries its own timestamp and belongs to no cascade.
      await service.deleteLineItems([removed.id])
      await service.softDeleteCarts([cart.id])
      await service.restoreCarts([cart.id])

      const lineItems = await service.listLineItems({ cartId: cart.id })
      expect(lineItems.map((item) => item.id)).toEqual([kept.id])
    })

    test('softDeleteCarts — leaves another cart untouched', async ({ expect, dto }) => {
      const deleted = await service.createCart(dto.generate.createCart())
      const kept = await service.createCart(dto.generate.createCart())
      await service.addLineItems(kept.id, [dto.generate.createLineItem()])

      await service.softDeleteCarts([deleted.id])

      expect(await service.listLineItems({ cartId: kept.id })).toHaveLength(1)
    })
  })
})
