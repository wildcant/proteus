import { z } from 'zod'
import { StorePaymentCollection, StorePaymentProvider, StorePaymentSession, StoreSavedMethod } from './entities.js'

export const StorePaymentProviderListResponse = z
  .object({ paymentProviders: z.array(StorePaymentProvider) })
  .openapi('StorePaymentProviderListResponse')
export type StorePaymentProviderListResponse = z.input<typeof StorePaymentProviderListResponse>

export const StoreSavedMethodListResponse = z
  .object({ paymentMethods: z.array(StoreSavedMethod) })
  .openapi('StoreSavedMethodListResponse')
export type StoreSavedMethodListResponse = z.input<typeof StoreSavedMethodListResponse>

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
