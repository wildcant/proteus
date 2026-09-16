/** An inventory level is identified by its item and its location, never by one of them alone. */
export function levelKey(row: { inventoryItemId: string; locationId: string }): string {
  return `${row.inventoryItemId}@${row.locationId}`
}
