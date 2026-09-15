import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import {
  type CreateInventoryItem,
  type CreateInventoryLevel,
  type CreateProductVariantInventoryItem,
  type CreateReservationItem,
  inventoryItemTable,
  inventoryLevelTable,
  productVariantInventoryItemTable,
  reservationItemTable,
} from '../../../src/schema.gen.js'
import { db } from '../../db/client.js'

/**
 * Rows written straight to the database, for the browser suite: the module service is out of
 * process there, so an e2e arranges stock the same way it arranges a region or a store.
 *
 * `reservedQuantity` is settable here and only here — the module refuses it on its create DTO,
 * because the counter moves through reservations. A spec that wants units already committed
 * either writes the counter with the reservation beside it, or explains the gap it just made.
 */
export function generateInventoryItem(overrides?: Partial<CreateInventoryItem>): CreateInventoryItem {
  return {
    sku: faker.string.alphanumeric(10).toUpperCase(),
    ...overrides,
  }
}

export async function createInventoryItem(overrides?: Partial<CreateInventoryItem>) {
  const [item] = await db.insert(inventoryItemTable).values(generateInventoryItem(overrides)).returning()
  if (!item) throw new Error('InventoryItem insert returned no rows')

  return {
    ...item,
    [Symbol.asyncDispose]: async () => {
      await deleteInventoryItemById(item.id)
    },
  }
}

export async function deleteInventoryItemById(id: string) {
  await db.delete(inventoryItemTable).where(eq(inventoryItemTable.id, id))
}

export async function createInventoryLevel(values: CreateInventoryLevel) {
  const [level] = await db.insert(inventoryLevelTable).values(values).returning()
  if (!level) throw new Error('InventoryLevel insert returned no rows')

  return {
    ...level,
    [Symbol.asyncDispose]: async () => {
      await db.delete(inventoryLevelTable).where(eq(inventoryLevelTable.id, level.id))
    },
  }
}

/** The link the whole inventory read walks: no link, and the variant is untracked in practice. */
export async function createProductVariantInventoryItem(values: CreateProductVariantInventoryItem) {
  const [link] = await db.insert(productVariantInventoryItemTable).values(values).returning()
  if (!link) throw new Error('ProductVariantInventoryItem insert returned no rows')

  return {
    ...link,
    [Symbol.asyncDispose]: async () => {
      await db.delete(productVariantInventoryItemTable).where(eq(productVariantInventoryItemTable.id, link.id))
    },
  }
}

export async function createReservationItem(values: CreateReservationItem) {
  const [reservation] = await db.insert(reservationItemTable).values(values).returning()
  if (!reservation) throw new Error('ReservationItem insert returned no rows')

  return {
    ...reservation,
    [Symbol.asyncDispose]: async () => {
      await db.delete(reservationItemTable).where(eq(reservationItemTable.id, reservation.id))
    },
  }
}
