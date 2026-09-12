import { queryOptions, useQuery } from '@tanstack/react-query'
import { listPaymentProviders } from '#/api/generated/payment-providers/payment-providers'
import { queryKeysFactory } from '#/lib/query-key-factory'

const paymentProviderKeys = queryKeysFactory<'paymentProviders'>('paymentProviders')

const paymentProvidersQueryOptions = () =>
  queryOptions({
    queryKey: paymentProviderKeys.lists(),
    queryFn: () => listPaymentProviders(),
  })

/** The gateways a region may be given. Enabled only — the API refuses to offer the rest. */
export const usePaymentProviders = () => useQuery(paymentProvidersQueryOptions())
