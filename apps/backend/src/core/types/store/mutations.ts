export type CreateStoreCurrencyDTO = {
  currencyCode: string
  isDefault?: boolean
}

export type CreateStoreDTO = {
  name: string
  defaultRegionId?: string | null
  metadata?: string | null
  /** Created with the store, so a store never exists without the currencies it trades in. */
  currencies?: CreateStoreCurrencyDTO[]
}

export type UpdateStoreDTO = {
  name?: string
  defaultRegionId?: string | null
  metadata?: string | null
}
