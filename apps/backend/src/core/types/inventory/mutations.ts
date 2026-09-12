export type CreateInventoryItemDTO = {
  sku?: string | null
  originCountry?: string | null
  hsCode?: string | null
  midCode?: string | null
  material?: string | null
  weight?: number | null
  length?: number | null
  height?: number | null
  width?: number | null
  requiresShipping?: boolean
  description?: string | null
  title?: string | null
  thumbnail?: string | null
  metadata?: string | null
}

export type UpdateInventoryItemDTO = {
  sku?: string | null
  originCountry?: string | null
  hsCode?: string | null
  midCode?: string | null
  material?: string | null
  weight?: number | null
  length?: number | null
  height?: number | null
  width?: number | null
  requiresShipping?: boolean
  description?: string | null
  title?: string | null
  thumbnail?: string | null
  metadata?: string | null
}

export type CreateInventoryLevelDTO = {
  inventoryItemId: string
  locationId: string
  stockedQuantity?: number
  reservedQuantity?: number
  incomingQuantity?: number
  metadata?: string | null
}

export type CreateReservationItemDTO = {
  inventoryItemId: string
  locationId: string
  quantity: number
  lineItemId?: string | null
  allowBackorder?: boolean
  externalId?: string | null
  description?: string | null
  createdBy?: string | null
  metadata?: string | null
}
