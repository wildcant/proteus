import { queryOptions, useQuery } from '@tanstack/react-query'
import { listAdminShippingOptions } from '#/api/generated/shipping-options/shipping-options'
import { queryKeysFactory } from '#/lib/query-key-factory'

const shippingOptionKeys = queryKeysFactory('shipping-options')

export const shippingOptionsListQueryOptions = () =>
  queryOptions({
    queryKey: shippingOptionKeys.list(),
    queryFn: () => listAdminShippingOptions(),
  })

export const useShippingOptions = () => useQuery(shippingOptionsListQueryOptions())
