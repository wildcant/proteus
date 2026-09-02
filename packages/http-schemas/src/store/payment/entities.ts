import { z } from 'zod'
import { bigNumberToString, dateToIso, timestamps } from '../../common.js'

export const StorePaymentProvider = z
  .object({
    id: z.string(),
    isEnabled: z.boolean(),
    label: z.string(),
    isTestOnly: z.boolean(),
    /**
     * What the storefront's adapter for this provider boots from — Stripe's publishable key,
     * later Mercado Pago's public key and locale. Assembled server-side from an allowlist per
     * provider, so enabling a provider stays a backend concern with no storefront rebuild.
     *
     * Deliberately open-shaped: only the provider's own client adapter reads it, and a schema
     * that enumerated Stripe's keys would have to change for every provider added.
     */
    publicConfig: z.record(z.string(), z.unknown()),
  })
  .openapi('StorePaymentProvider')
export type StorePaymentProvider = z.input<typeof StorePaymentProvider>

export const StorePaymentSession = z
  .object({
    id: z.string(),
    paymentCollectionId: z.string(),
    providerId: z.string(),
    currencyCode: z.string(),
    amount: bigNumberToString,
    status: z.enum([
      'pending',
      'authorized',
      'captured',
      'requires_more',
      'error',
      'canceled',
      'pending_authorization',
    ]),
    data: z.record(z.string(), z.unknown()),
    context: z.record(z.string(), z.unknown()).nullable(),
    authorizedAt: dateToIso.nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    ...timestamps.shape,
  })
  .openapi('StorePaymentSession')
export type StorePaymentSession = z.input<typeof StorePaymentSession>

export const StorePaymentCollection = z
  .object({
    id: z.string(),
    currencyCode: z.string(),
    amount: bigNumberToString,
    authorizedAmount: bigNumberToString.nullable(),
    capturedAmount: bigNumberToString.nullable(),
    refundedAmount: bigNumberToString.nullable(),
    completedAt: dateToIso.nullable(),
    status: z.enum(['not_paid', 'awaiting', 'authorized', 'partially_authorized', 'completed']),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    ...timestamps.shape,
  })
  .openapi('StorePaymentCollection')
export type StorePaymentCollection = z.input<typeof StorePaymentCollection>
