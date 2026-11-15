import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { WorkflowContext } from '@core/workflows/types.js'

/**
 * Announces an Order as placed, and the inventory levels its reservation lowered. The final step of
 * checkout and of converting a Draft Order.
 *
 * **It is the final step, and that ordering is the entire transactional story.** There is no
 * staging area and no event group: a workflow that fails earlier simply never reaches it, so a
 * compensated run publishes nothing.
 *
 * A bare `await` with no `try` around it, deliberately. `emit` never rejects — the port's contract
 * on every adapter (`core/event-bus/types.ts`) — because by now the Order is real, and a rejection
 * here would compensate it over a transport blip.
 *
 * The id is one an earlier step already recorded, not one minted here. That is what keeps the
 * dispatch identity the same when this step is retried; an id created inside this action would be
 * new per attempt, and a second confirmation would go out with nothing to say it had.
 */
export async function publishOrderPlacedStep(
  ctx: WorkflowContext,
  input: { orderId: string; levelIds: string[] },
): Promise<void> {
  await ctx.step('publish-order-placed', async ({ container }) => {
    const bus = container.resolve(ContainerRegistrationKeys.EVENT_BUS)

    /** The reservation is one of the three ways Available Quantity falls, and it is announced from
     *  here rather than from `reserve-inventory` because that step is not the last one: a run that
     *  unwinds releases what it reserved, and a low-stock alert already sent about a shelf that
     *  filled back up cannot be taken back.
     *
     *  Read before the first emit, not between the two. `emit` cannot reject but this read can,
     *  and a throw after `order.placed` had gone out would compensate a workflow whose event had
     *  already escaped — the confirmation email sent for an order the unwind then removed.
     *
     *  The quantities are re-read rather than carried, so what is published is what the level
     *  holds now — including whatever else moved it between the reservation and here. */
    const inventoryService = container.resolve(Modules.INVENTORY)
    const levels = input.levelIds.length > 0 ? await inventoryService.listInventoryLevels({ id: input.levelIds }) : []

    await bus.emit('order.placed', { id: input.orderId })

    await Promise.all(
      levels.map((level) =>
        bus.emit('inventory.available_decreased', {
          id: level.id,
          version: level.version,
          stockedQuantity: level.stockedQuantity,
          reservedQuantity: level.reservedQuantity,
        }),
      ),
    )
  })
}
