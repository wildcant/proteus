import { ErrorTypes } from '@core/errors/app-error.js'
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
      await service.softDeleteLineItems([removed.id])
      await service.softDeleteCarts([cart.id])
      await service.restoreCarts([cart.id])

      const lineItems = await service.listLineItems({ cartId: cart.id })
      expect(lineItems.map((item) => item.id)).toEqual([kept.id])
    })

    test('softDeleteCarts — hides the cart addresses', async ({ expect, dto }) => {
      const cart = await service.createCart(dto.generate.createCart())
      await service.upsertCartAddress(cart.id, 'shipping', dto.generate.createCartAddress())
      await service.upsertCartAddress(cart.id, 'billing', dto.generate.createCartAddress())

      await service.softDeleteCarts([cart.id])

      expect(await service.listCartAddresses({ cartId: cart.id })).toHaveLength(0)
    })

    test('restoreCarts — brings the addresses back', async ({ expect, dto }) => {
      const cart = await service.createCart(dto.generate.createCart())
      await service.upsertCartAddress(cart.id, 'shipping', dto.generate.createCartAddress())

      await service.softDeleteCarts([cart.id])
      await service.restoreCarts([cart.id])

      expect(await service.listCartAddresses({ cartId: cart.id })).toHaveLength(1)
    })

    test('softDeleteCarts — leaves another cart untouched', async ({ expect, dto }) => {
      const deleted = await service.createCart(dto.generate.createCart())
      const kept = await service.createCart(dto.generate.createCart())
      await service.addLineItems(kept.id, [dto.generate.createLineItem()])

      await service.softDeleteCarts([deleted.id])

      expect(await service.listLineItems({ cartId: kept.id })).toHaveLength(1)
    })
  })

  // ---------------------------------------------------------------------------
  // Completed carts
  //
  // `completedAt` is a cart's only state, so it is the thing every write guard consults. The
  // positive case is covered by the cascade tests above, which add to live carts freely.
  // ---------------------------------------------------------------------------

  test.describe('Completed carts', () => {
    test('addLineItems — refuses a cart that has been completed', async ({ expect, dto }) => {
      const cart = await service.createCart(dto.generate.createCart())
      await service.updateCart(cart.id, { completedAt: new Date() })

      await expect(service.addLineItems(cart.id, [dto.generate.createLineItem()])).rejects.toMatchObject({
        type: ErrorTypes.NOT_ALLOWED,
      })
    })

    test('addLineItem — refuses a cart that has been completed', async ({ expect, dto }) => {
      const cart = await service.createCart(dto.generate.createCart())
      await service.updateCart(cart.id, { completedAt: new Date() })

      await expect(service.addLineItem(cart.id, dto.generate.createLineItem())).rejects.toMatchObject({
        type: ErrorTypes.NOT_ALLOWED,
      })
    })

    test('addShippingMethods — refuses a cart that has been completed', async ({ expect, dto }) => {
      const cart = await service.createCart(dto.generate.createCart())
      await service.updateCart(cart.id, { completedAt: new Date() })

      await expect(service.addShippingMethods(cart.id, [dto.generate.createShippingMethod()])).rejects.toMatchObject({
        type: ErrorTypes.NOT_ALLOWED,
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Line item plans
  //
  // An addition writes two kinds of row at once — the lines it starts and the lines it raises.
  // Both are rows of `cart_line_item`, so one transaction covers them and the caller needs no
  // compensation. These assert that boundary holds.
  // ---------------------------------------------------------------------------

  test.describe('Line item plans', () => {
    test('applyLineItemPlan — creates and raises in one call', async ({ expect, dto }) => {
      const cart = await service.createCart(dto.generate.createCart())
      const held = await service.addLineItem(cart.id, dto.generate.createLineItem({ quantity: 1 }))

      const written = await service.applyLineItemPlan(cart.id, {
        create: [dto.generate.createLineItem({ quantity: 2 })],
        merge: [{ id: held.id, data: { quantity: 4 } }],
      })

      expect(written).toHaveLength(2)
      const lineItems = await service.listLineItems({ cartId: cart.id })
      expect(lineItems).toHaveLength(2)
      expect(lineItems.find((lineItem) => lineItem.id === held.id)).toMatchObject({ quantity: 4 })
    })

    test('applyLineItemPlan — writes nothing when one of the raises fails', async ({ expect, dto }) => {
      const cart = await service.createCart(dto.generate.createCart())

      // The half-applied addition the workflow used to need a compensation for: the new line is
      // written, then a line that is not there any more is raised.
      await expect(
        service.applyLineItemPlan(cart.id, {
          create: [dto.generate.createLineItem()],
          merge: [{ id: 'cali_gone', data: { quantity: 2 } }],
        }),
      ).rejects.toMatchObject({ type: ErrorTypes.NOT_FOUND })

      expect(await service.listLineItems({ cartId: cart.id })).toEqual([])
    })

    test('applyLineItemPlan — refuses a cart that has been completed', async ({ expect, dto }) => {
      const cart = await service.createCart(dto.generate.createCart())
      await service.updateCart(cart.id, { completedAt: new Date() })

      await expect(
        service.applyLineItemPlan(cart.id, { create: [dto.generate.createLineItem()], merge: [] }),
      ).rejects.toMatchObject({ type: ErrorTypes.NOT_ALLOWED })
    })
  })

  // ---------------------------------------------------------------------------
  // Address ownership
  //
  // A cart owns its addresses rather than pointing at them, so `type` is what identifies a
  // slot and replacing an address rewrites the row that holds it.
  // ---------------------------------------------------------------------------

  test.describe('Cart addresses', () => {
    test('upsertCartAddress — fills a type, then replaces it in place', async ({ expect, dto }) => {
      const cart = await service.createCart(dto.generate.createCart())

      const created = await service.upsertCartAddress(cart.id, 'shipping', dto.generate.createCartAddress())
      const replaced = await service.upsertCartAddress(
        cart.id,
        'shipping',
        dto.generate.createCartAddress({ city: 'Shelbyville' }),
      )

      expect(replaced.id).toBe(created.id)
      expect(await service.listCartAddresses({ cartId: cart.id })).toMatchObject([
        { type: 'shipping', city: 'Shelbyville' },
      ])
    })

    test('upsertCartAddress — the two types are separate rows', async ({ expect, dto }) => {
      const cart = await service.createCart(dto.generate.createCart())

      await service.upsertCartAddress(cart.id, 'shipping', dto.generate.createCartAddress())
      await service.upsertCartAddress(cart.id, 'billing', dto.generate.createCartAddress())

      const addresses = await service.listCartAddresses({ cartId: cart.id })
      expect(addresses.map((address) => address.type).sort()).toEqual(['billing', 'shipping'])
    })

    test('upsertCartAddress — a type freed by a delete can be filled again', async ({ expect, dto }) => {
      const cart = await service.createCart(dto.generate.createCart())
      const first = await service.upsertCartAddress(cart.id, 'shipping', dto.generate.createCartAddress())

      // The unique index excludes soft-deleted rows, so the slot is released rather than burned.
      await service.softDeleteCartAddresses([first.id])
      const second = await service.upsertCartAddress(cart.id, 'shipping', dto.generate.createCartAddress())

      expect(second.id).not.toBe(first.id)
      expect(await service.listCartAddresses({ cartId: cart.id })).toHaveLength(1)
    })

    test('upsertCartAddress — refuses an address with no cart to belong to', async ({ expect, dto }) => {
      await expect(
        service.upsertCartAddress('cart_nonexistent', 'shipping', dto.generate.createCartAddress()),
      ).rejects.toMatchObject({ type: ErrorTypes.NOT_FOUND })
    })
  })
})
