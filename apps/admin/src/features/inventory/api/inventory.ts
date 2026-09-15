import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { listInventoryItems } from '#/api/generated/inventory/inventory'
import type { ListInventoryItemsParams, ListReservationsParams } from '#/api/generated/model'
import { listReservations } from '#/api/generated/reservations/reservations'
import { queryKeysFactory } from '#/lib/query-key-factory'

const inventoryItemKeys = queryKeysFactory<'inventoryItems', ListInventoryItemsParams>('inventoryItems')

export const inventoryItemsListQueryOptions = (params?: ListInventoryItemsParams) =>
  queryOptions({
    queryKey: inventoryItemKeys.list(params),
    queryFn: () => listInventoryItems(params),
    placeholderData: keepPreviousData,
  })

export const useInventoryItems = (params?: ListInventoryItemsParams) => useQuery(inventoryItemsListQueryOptions(params))

const reservationKeys = queryKeysFactory<'reservations', ListReservationsParams>('reservations')

export const reservationsListQueryOptions = (params?: ListReservationsParams) =>
  queryOptions({
    queryKey: reservationKeys.list(params),
    queryFn: () => listReservations(params),
    placeholderData: keepPreviousData,
  })

export const useReservations = (params?: ListReservationsParams) => useQuery(reservationsListQueryOptions(params))
