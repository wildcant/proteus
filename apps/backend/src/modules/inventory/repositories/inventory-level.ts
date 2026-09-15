import { and, eq, isNull, sql } from 'drizzle-orm'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import { dbErrorMapper } from '../../../core/errors/db-error-mapper.js'
import type { Context } from '../../../core/types/context.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'
import { inventoryLevelTable } from '../models/inventory-level.js'

type InventoryLevel = typeof inventoryLevelTable.$inferSelect

/** The two counters a write to a level can move. `version` is never passed in — it is derived. */
type MovedQuantities = Partial<Pick<InventoryLevel, 'stockedQuantity' | 'reservedQuantity'>>

export class InventoryLevelRepository extends BaseRepository(inventoryLevelTable) {
  /**
   * Writes new quantities and bumps `version`, returning the row as committed.
   *
   * The bump is `version = version + 1` evaluated **by Postgres**, not `level.version + 1` computed
   * from a row read earlier. That difference is the whole reason this method exists rather than the
   * inherited `update`: two transactions that read the same level before either writes would both
   * compute the same successor, commit it, and hand two genuinely different changes one identity.
   * `inventory.available_decreased` keys on that identity, so the collision would not be a stale
   * number — it would be a low-stock alert silently deduplicated away, with no error and no log
   * line. Written this way the second writer blocks on the row lock and increments what the first
   * one left, so no two committed writes to one level can ever share a version.
   *
   * The quantities keep the read-modify-write shape the callers already had; a lost update there
   * costs a wrong number that the next read corrects, which is a different problem from two changes
   * wearing one name.
   */
  async updateBumpingVersion(id: string, data: MovedQuantities, context?: Context): Promise<InventoryLevel> {
    const client = this.getClient(context)
    const rows = await client
      .update(inventoryLevelTable)
      .set({ ...data, version: sql`${inventoryLevelTable.version} + 1` })
      .where(and(eq(inventoryLevelTable.id, id), isNull(inventoryLevelTable.deletedAt)))
      .returning()
      .catch(dbErrorMapper)

    const row = rows[0] as InventoryLevel | undefined
    if (!row) {
      throw new AppError({ type: ErrorTypes.NOT_FOUND, message: `Inventory level with id "${id}" not found` })
    }
    return row
  }
}
