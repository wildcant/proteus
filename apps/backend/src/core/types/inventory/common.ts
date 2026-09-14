import type { BaseFilterable, OperatorMap } from '../common.js'

export type InventoryItemDTO = {
  id: string
  sku: string | null
  originCountry: string | null
  hsCode: string | null
  midCode: string | null
  material: string | null
  weight: number | null
  length: number | null
  height: number | null
  width: number | null
  requiresShipping: boolean
  description: string | null
  title: string | null
  thumbnail: string | null
  createdAt: Date
  deletedAt: Date | null
}

export interface FilterableInventoryItemProps extends BaseFilterable<FilterableInventoryItemProps> {
  id?: string | string[]
  sku?: string | string[] | OperatorMap<string>
  title?: string | OperatorMap<string>
  requiresShipping?: boolean
  createdAt?: OperatorMap<Date>
}

export type InventoryLevelDTO = {
  id: string
  inventoryItemId: string
  locationId: string
  stockedQuantity: number
  reservedQuantity: number
  incomingQuantity: number
  createdAt: Date
  deletedAt: Date | null
}

export interface FilterableInventoryLevelProps extends BaseFilterable<FilterableInventoryLevelProps> {
  id?: string | string[]
  inventoryItemId?: string | string[]
  locationId?: string | string[]
  stockedQuantity?: OperatorMap<number>
  reservedQuantity?: OperatorMap<number>
  createdAt?: OperatorMap<Date>
}

export type ReservationItemDTO = {
  id: string
  inventoryItemId: string
  locationId: string
  quantity: number
  lineItemId: string | null
  allowBackorder: boolean
  externalId: string | null
  description: string | null
  createdBy: string | null
  createdAt: Date
  deletedAt: Date | null
}

export interface FilterableReservationItemProps extends BaseFilterable<FilterableReservationItemProps> {
  id?: string | string[]
  inventoryItemId?: string | string[]
  locationId?: string | string[]
  lineItemId?: string | string[]
  createdAt?: OperatorMap<Date>
}
