import { z } from 'zod'
import { StorePaymentCollection, StorePaymentProvider, StorePaymentSession } from './entities.js'

export const StorePaymentProviderListResponse = z
  .object({ paymentProviders: z.array(StorePaymentProvider) })
  .openapi('StorePaymentProviderListResponse')
export type StorePaymentProviderListResponse = z.input<typeof StorePaymentProviderListResponse>

export const StoreCreatePaymentCollectionResponse = z
  .object({ paymentCollection: StorePaymentCollection })
  .openapi('StoreCreatePaymentCollectionResponse')
export type StoreCreatePaymentCollectionResponse = z.input<typeof StoreCreatePaymentCollectionResponse>

export const StoreCreatePaymentSessionResponse = z
  .object({ paymentSession: StorePaymentSession })
  .openapi('StoreCreatePaymentSessionResponse')
export type StoreCreatePaymentSessionResponse = z.input<typeof StoreCreatePaymentSessionResponse>

export const StoreUpdatePaymentSessionResponse = z
  .object({ paymentSession: StorePaymentSession })
  .openapi('StoreUpdatePaymentSessionResponse')
export type StoreUpdatePaymentSessionResponse = z.input<typeof StoreUpdatePaymentSessionResponse>
