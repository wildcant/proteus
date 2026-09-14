import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { Context } from '@core/types/context.js'
import type { CreateInventoryLevelDTO } from '@core/types/inventory/mutations.js'
import { test } from '@tests/setup/test-extend.js'
import { vi } from 'vitest'
import { buildCascadeGraph } from '../../../core/db/cascade-graph.js'
import { createWithTransaction } from '../../../core/utils/with-transaction.js'
import type { Database } from '../../../schema.type.js'
import inventoryModule from '../index.js'
import { InventoryItemRepository } from '../repositories/inventory-item.js'
import { InventoryLevelRepository } from '../repositories/inventory-level.js'
import { ReservationItemRepository } from '../repositories/reservation-item.js'
import { InventoryModuleService } from '../services/inventory-module-service.js'

const cascadeGraph = buildCascadeGraph(inventoryModule.models)

/**
 * The half of the counter's rule that is a compile error rather than a failing assertion.
 *
 * `reservedQuantity` moves through reservations or it is not a counter, so a level create that
 * could set it is a second, silent writer. Medusa strips the field from the input at runtime; the
 * type is the stronger form of the same rule, and `@ts-expect-error` is how it is asserted — the
 * directive fails `pnpm typecheck` the day the field comes back and the line stops being an error.
 * vitest sees this file with the types stripped, so the `test` blocks below assert the runtime half.
 */
function typeAssertions(): CreateInventoryLevelDTO {
  return {
    inventoryItemId: 'iitem_1',
    locationId: 'sloc_1',
    stockedQuantity: 5,
    // @ts-expect-error — reservedQuantity is not on CreateInventoryLevelDTO, by design.
    reservedQuantity: 5,
  }
}

let service: InventoryModuleService
let inventoryLevelRepository: InventoryLevelRepository

test.beforeEach(({ getDb, logger }) => {
  inventoryLevelRepository = new InventoryLevelRepository({ getDb, cascadeGraph })
  service = new InventoryModuleService({
    inventoryItemRepository: new InventoryItemRepository({ getDb, cascadeGraph }),
    inventoryLevelRepository,
    reservationItemRepository: new ReservationItemRepository({ getDb, cascadeGraph }),
    withTransaction: createWithTransaction(getDb),
    logger,
  })
})

test.describe('InventoryModuleService reservations', () => {
  test('reserving lowers available quantity, releasing restores it, and restoring takes it again', async ({
    expect,
    dto,
  }) => {
    const item = await service.createInventoryItem(dto.generate.createInventoryItem())
    const level = await service.createInventoryLevel(
      dto.generate.createInventoryLevel({ inventoryItemId: item.id, stockedQuantity: 10 }),
    )

    const [reservation] = await service.createReservationItems([
      dto.generate.createReservationItem({ inventoryItemId: item.id, locationId: level.locationId, quantity: 4 }),
    ])
    if (!reservation) throw new Error('createReservationItems returned no rows')

    expect(await service.retrieveAvailableQuantity(item.id)).toBe(6)

    // Releasing is what cancelling an order does, and the units have to come back to the shelf.
    await service.softDeleteReservationItems([reservation.id])
    expect(await service.retrieveAvailableQuantity(item.id)).toBe(10)

    // Restoring is the compensation half: a workflow that released and then failed owes them back.
    await service.restoreReservationItems([reservation.id])
    expect(await service.retrieveAvailableQuantity(item.id)).toBe(6)
  })

  test('a level arrives holding stock and committing none of it', async ({ expect, dto }) => {
    const item = await service.createInventoryItem(dto.generate.createInventoryItem())
    const level = await service.createInventoryLevel(
      dto.generate.createInventoryLevel({ inventoryItemId: item.id, stockedQuantity: 10 }),
    )

    expect(level).toMatchObject({ stockedQuantity: 10, reservedQuantity: 0 })

    // The rule is a compile error rather than a runtime strip — the field is still on the object
    // here, and the directive inside typeAssertions is what stops it reaching a level create.
    expect('reservedQuantity' in typeAssertions()).toBe(true)
  })

  test('reserving more than is available is refused, and reserves nothing', async ({ expect, dto }) => {
    const item = await service.createInventoryItem(dto.generate.createInventoryItem())
    const level = await service.createInventoryLevel(
      dto.generate.createInventoryLevel({ inventoryItemId: item.id, stockedQuantity: 3 }),
    )

    const error = await service
      .createReservationItems([
        dto.generate.createReservationItem({ inventoryItemId: item.id, locationId: level.locationId, quantity: 4 }),
      ])
      .catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.NOT_ALLOWED)
    // A refusal that still wrote the row, or still moved the counter, has refused nothing.
    expect(await service.listReservationItems({ inventoryItemId: item.id })).toEqual([])
    expect(await service.retrieveAvailableQuantity(item.id)).toBe(3)
  })

  test('a backorder reservation goes past what is on the shelf and still reserves it', async ({ expect, dto }) => {
    const item = await service.createInventoryItem(dto.generate.createInventoryItem())
    const level = await service.createInventoryLevel(
      dto.generate.createInventoryLevel({ inventoryItemId: item.id, stockedQuantity: 1 }),
    )

    const [reservation] = await service.createReservationItems([
      dto.generate.createReservationItem({
        inventoryItemId: item.id,
        locationId: level.locationId,
        quantity: 5,
        allowBackorder: true,
      }),
    ])

    expect(reservation?.allowBackorder).toBe(true)
    // Negative is the point: a backorder is stock promised before it is on the shelf.
    expect(await service.retrieveAvailableQuantity(item.id)).toBe(-4)
  })

  test('reserving where the item has no level names the item and the location, backorder or not', async ({
    expect,
    dto,
  }) => {
    // A level at a *different* location, so the refusal cannot come from the item being unknown.
    const item = await service.createInventoryItem(dto.generate.createInventoryItem())
    await service.createInventoryLevel(dto.generate.createInventoryLevel({ inventoryItemId: item.id }))
    const elsewhere = dto.generate.createReservationItem({ inventoryItemId: item.id, quantity: 1 })

    const error = await service.createReservationItems([elsewhere]).catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.NOT_FOUND)
    expect(error.message).toContain(item.id)
    expect(error.message).toContain(elsewhere.locationId)

    // Backorder skips the coverage check and nothing else. With no level there is no row for
    // fulfillment to adjust, so the location still has to be one the item is held at.
    const backordered = await service.createReservationItems([{ ...elsewhere, allowBackorder: true }]).catch((e) => e)

    expect(AppError.isError(backordered)).toBe(true)
    expect(backordered.type).toBe(ErrorTypes.NOT_FOUND)
  })

  test('releasing a reservation whose level has gone still releases it, and says so', async ({
    expect,
    dto,
    logger,
  }) => {
    const item = await service.createInventoryItem(dto.generate.createInventoryItem())
    const level = await service.createInventoryLevel(
      dto.generate.createInventoryLevel({ inventoryItemId: item.id, stockedQuantity: 10 }),
    )
    const [reservation] = await service.createReservationItems([
      dto.generate.createReservationItem({ inventoryItemId: item.id, locationId: level.locationId, quantity: 4 }),
    ])
    if (!reservation) throw new Error('createReservationItems returned no rows')

    const warn = vi.spyOn(logger, 'warn')
    // Nothing deletes a level today, so this is arranged rather than reached. The release paths run
    // no equivalent of `assertEveryPairHasALevel`, and cancelling an order is the first real caller.
    await inventoryLevelRepository.softDelete([level.id])

    await service.softDeleteReservationItems([reservation.id])

    // Refusing would strand the units *and* fail the cancellation that was releasing them, so the
    // release finishes. The counter it could not move is a data fault, so it is not passed over in
    // silence either.
    expect(await service.listReservationItems({ inventoryItemId: item.id })).toEqual([])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`${item.id}@${level.locationId}`))
  })

  // TODO: reserving is check-then-act across a read and a write, so two checkouts can both take the
  // last unit. This test is `fails` because that lost update is the current behaviour: when
  // reserving becomes atomic — a row lock, or `reserved_quantity = reserved_quantity + n` — the
  // second transaction's write lands on the first's committed value, the assertion starts passing,
  // and this marker goes red to say the defect is gone. Locking is its own item; see ILLO-124.
  test.fails('two transactions reserving the same unit lose one of the two increments', async ({
    expect,
    dto,
    getDb,
  }) => {
    const item = await service.createInventoryItem(dto.generate.createInventoryItem())
    const level = await service.createInventoryLevel(
      dto.generate.createInventoryLevel({ inventoryItemId: item.id, stockedQuantity: 1 }),
    )
    const reserveOne = () =>
      dto.generate.createReservationItem({ inventoryItemId: item.id, locationId: level.locationId, quantity: 1 })

    const second = openTransaction(getDb())
    const secondTransaction = await second.transaction
    const first = openTransaction(getDb())

    // Both transactions have to read the counter before either writes it, and the second has to
    // write after the first has committed — otherwise it blocks on the row and this becomes a
    // timing race rather than the deterministic lost update it is meant to be. Only *when* the
    // second writes is arranged here; *what* it writes is the service's own arithmetic.
    const firstHasCommitted = deferred<void>()
    const secondIsAboutToWrite = deferred<void>()
    const write = inventoryLevelRepository.update.bind(inventoryLevelRepository)
    vi.spyOn(inventoryLevelRepository, 'update').mockImplementation(async (id, data, context) => {
      if (context?.transaction === secondTransaction) {
        secondIsAboutToWrite.settle()
        await firstHasCommitted.promise
      }
      return write(id, data, context)
    })

    const secondReservation = service.createReservationItems([reserveOne()], { transaction: secondTransaction })
    await secondIsAboutToWrite.promise

    await service.createReservationItems([reserveOne()], { transaction: await first.transaction })
    await first.commit()
    firstHasCommitted.settle()

    await secondReservation
    await second.commit()

    expect(await service.listReservationItems({ inventoryItemId: item.id })).toHaveLength(2)
    // Two units are spoken for, and one of the two increments was written over.
    expect((await service.listInventoryLevels({ id: level.id }))[0]?.reservedQuantity).toBe(2)
  })
})

/**
 * A promise the test settles by hand, for holding one transaction while another gets ahead of it.
 * The placeholder is replaced before this returns — a `Promise` executor runs synchronously.
 */
function deferred<T>() {
  let settle: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolve) => {
    settle = resolve
  })

  return { promise, settle: (value: T) => settle(value) }
}

/**
 * A transaction the caller commits, rather than one a callback closes on its own — the only way to
 * hold two of them open at once and interleave what they do.
 */
function openTransaction(db: Database) {
  const started = deferred<Context['transaction']>()
  const committed = deferred<void>()

  const finished = db.transaction(async (transaction) => {
    started.settle(transaction)
    await committed.promise
  })

  return {
    transaction: started.promise,
    commit: () => {
      committed.settle()
      return finished
    },
  }
}
