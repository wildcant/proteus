import type { CartLineItemDTO } from '@core/types/cart/common.js'
import type { ICartModuleService } from '@core/types/cart/service.js'
import type { InventoryLevelDTO } from '@core/types/inventory/common.js'
import type { IInventoryModuleService } from '@core/types/inventory/service.js'
import type { ProductVariantInventoryItemDTO } from '@core/types/link/common.js'
import type { ILinkService } from '@core/types/link/service.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createSimpleWorkflowEngine } from '@core/workflows/simple-adapter.js'
import { setWorkflowEngine } from '@core/workflows/types.js'
import { test } from '@tests/setup/test-extend.js'
import { asValue, createContainer } from 'awilix'
import { noopLogger } from '../../../framework/logger/noop-logger.js'
import { confirmInventoryWorkflow } from '../confirm-inventory-workflow.js'

function setupWorkflow(opts: {
  lineItems: CartLineItemDTO[]
  mappings: ProductVariantInventoryItemDTO[]
  levels: InventoryLevelDTO[]
}) {
  const cartService: Pick<ICartModuleService, 'listLineItems'> = {
    listLineItems: async () => opts.lineItems,
  }

  const linkService: ILinkService = {
    repo: (() => ({
      findByVariantIds: async () => opts.mappings,
    })) as ILinkService['repo'],
    dismissLinks: async () => ({}),
  }

  const inventoryService: Pick<IInventoryModuleService, 'listInventoryLevels' | 'confirmInventory'> = {
    listInventoryLevels: async () => opts.levels,
    confirmInventory: async (inventoryItemId, locationIds, quantity) => {
      const matching = opts.levels.filter(
        (l) => l.inventoryItemId === inventoryItemId && locationIds.includes(l.locationId),
      )
      const available = matching.reduce((sum, l) => sum + l.stockedQuantity - l.reservedQuantity, 0)
      return available >= quantity
    },
  }

  const container = createContainer()
  container.register({
    [Modules.CART]: asValue(cartService),
    [Modules.INVENTORY]: asValue(inventoryService),
    [ContainerRegistrationKeys.LINK]: asValue(linkService),
    [ContainerRegistrationKeys.LOGGER]: asValue(noopLogger),
  })

  setWorkflowEngine(createSimpleWorkflowEngine(), container)
}

test.describe('confirmInventoryWorkflow', () => {
  test('succeeds when stock covers all line items', async ({ dto, expect }) => {
    setupWorkflow({
      lineItems: [dto.generate.cartLineItem({ id: 'li_1', cartId: 'cart_1', variantId: 'var_1', quantity: 2 })],
      mappings: [dto.generate.productVariantInventoryItem({ variantId: 'var_1', inventoryItemId: 'inv_1' })],
      levels: [
        dto.generate.inventoryLevel({
          inventoryItemId: 'inv_1',
          locationId: 'loc_1',
          stockedQuantity: 10,
          reservedQuantity: 0,
        }),
      ],
    })

    const result = await confirmInventoryWorkflow.run({ cartId: 'cart_1' })

    expect(result).toEqual({
      cartId: 'cart_1',
      items: [
        {
          lineItemId: 'li_1',
          variantId: 'var_1',
          inventoryItemId: 'inv_1',
          requiredQuantity: 1,
          quantity: 2,
          locationIds: ['loc_1'],
        },
      ],
    })
  })

  test('throws when stock is insufficient', async ({ dto, expect }) => {
    setupWorkflow({
      lineItems: [dto.generate.cartLineItem({ id: 'li_1', cartId: 'cart_1', variantId: 'var_1', quantity: 5 })],
      mappings: [dto.generate.productVariantInventoryItem({ variantId: 'var_1', inventoryItemId: 'inv_1' })],
      levels: [
        dto.generate.inventoryLevel({
          inventoryItemId: 'inv_1',
          locationId: 'loc_1',
          stockedQuantity: 3,
          reservedQuantity: 1,
        }),
      ],
    })

    await expect(confirmInventoryWorkflow.run({ cartId: 'cart_1' })).rejects.toThrow(
      'Some variant does not have the required inventory',
    )
  })

  test('passes when stock across multiple locations covers the requirement', async ({ dto, expect }) => {
    setupWorkflow({
      lineItems: [dto.generate.cartLineItem({ id: 'li_1', cartId: 'cart_1', variantId: 'var_1', quantity: 8 })],
      mappings: [dto.generate.productVariantInventoryItem({ variantId: 'var_1', inventoryItemId: 'inv_1' })],
      levels: [
        dto.generate.inventoryLevel({
          inventoryItemId: 'inv_1',
          locationId: 'loc_1',
          stockedQuantity: 5,
          reservedQuantity: 0,
        }),
        dto.generate.inventoryLevel({
          inventoryItemId: 'inv_1',
          locationId: 'loc_2',
          stockedQuantity: 5,
          reservedQuantity: 0,
        }),
      ],
    })

    const result = await confirmInventoryWorkflow.run({ cartId: 'cart_1' })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.locationIds).toEqual(['loc_1', 'loc_2'])
  })

  test('skips line items without a variant', async ({ dto, expect }) => {
    setupWorkflow({
      lineItems: [dto.generate.cartLineItem({ id: 'li_custom', cartId: 'cart_1', variantId: null, quantity: 1 })],
      mappings: [],
      levels: [],
    })

    const result = await confirmInventoryWorkflow.run({ cartId: 'cart_1' })

    expect(result.items).toEqual([])
  })

  test('multiplies quantity by requiredQuantity when checking coverage', async ({ dto, expect }) => {
    setupWorkflow({
      lineItems: [dto.generate.cartLineItem({ id: 'li_1', cartId: 'cart_1', variantId: 'var_1', quantity: 2 })],
      mappings: [
        dto.generate.productVariantInventoryItem({
          variantId: 'var_1',
          inventoryItemId: 'inv_1',
          requiredQuantity: 3,
        }),
      ],
      levels: [
        dto.generate.inventoryLevel({
          inventoryItemId: 'inv_1',
          locationId: 'loc_1',
          stockedQuantity: 5,
          reservedQuantity: 0,
        }),
      ],
    })

    // needs 2 * 3 = 6, only 5 available
    await expect(confirmInventoryWorkflow.run({ cartId: 'cart_1' })).rejects.toThrow(
      'Some variant does not have the required inventory',
    )
  })

  test('throws when any variant in a multi-item cart is insufficient', async ({ dto, expect }) => {
    setupWorkflow({
      lineItems: [
        dto.generate.cartLineItem({ id: 'li_1', cartId: 'cart_1', variantId: 'var_1', quantity: 1 }),
        dto.generate.cartLineItem({ id: 'li_2', cartId: 'cart_1', variantId: 'var_2', quantity: 100 }),
      ],
      mappings: [
        dto.generate.productVariantInventoryItem({ variantId: 'var_1', inventoryItemId: 'inv_1' }),
        dto.generate.productVariantInventoryItem({ variantId: 'var_2', inventoryItemId: 'inv_2' }),
      ],
      levels: [
        dto.generate.inventoryLevel({
          inventoryItemId: 'inv_1',
          locationId: 'loc_1',
          stockedQuantity: 5,
          reservedQuantity: 0,
        }),
        dto.generate.inventoryLevel({
          inventoryItemId: 'inv_2',
          locationId: 'loc_1',
          stockedQuantity: 3,
          reservedQuantity: 0,
        }),
      ],
    })

    await expect(confirmInventoryWorkflow.run({ cartId: 'cart_1' })).rejects.toThrow(
      'Some variant does not have the required inventory',
    )
  })
})
