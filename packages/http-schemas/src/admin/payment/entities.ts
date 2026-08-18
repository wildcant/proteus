import { z } from 'zod'
import { bigNumberToString, dateToIso, timestamps } from '../../common.js'

export const AdminPaymentProvider = z
  .object({
    id: z.string(),
    isEnabled: z.boolean(),
  })
  .openapi('AdminPaymentProvider')
export type AdminPaymentProvider = z.input<typeof AdminPaymentProvider>

export const AdminCapture = z
  .object({
    id: z.string(),
    paymentId: z.string(),
    amount: bigNumberToString,
    createdBy: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    createdAt: dateToIso,
  })
  .openapi('AdminCapture')
export type AdminCapture = z.input<typeof AdminCapture>

export const AdminRefund = z
  .object({
    id: z.string(),
    paymentId: z.string(),
    refundReasonId: z.string().nullable(),
    amount: bigNumberToString,
    note: z.string().nullable(),
    createdBy: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    createdAt: dateToIso,
  })
  .openapi('AdminRefund')
export type AdminRefund = z.input<typeof AdminRefund>

export const AdminPayment = z
  .object({
    id: z.string(),
    paymentCollectionId: z.string(),
    paymentSessionId: z.string(),
    amount: bigNumberToString,
    currencyCode: z.string(),
    providerId: z.string(),
    data: z.record(z.string(), z.unknown()).nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    capturedAt: dateToIso.nullable(),
    canceledAt: dateToIso.nullable(),
    captures: z.array(AdminCapture).optional(),
    refunds: z.array(AdminRefund).optional(),
    ...timestamps.shape,
  })
  .openapi('AdminPayment')
export type AdminPayment = z.input<typeof AdminPayment>

export const AdminPaymentSession = z
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
    payment: AdminPayment.optional(),
    ...timestamps.shape,
  })
  .openapi('AdminPaymentSession')
export type AdminPaymentSession = z.input<typeof AdminPaymentSession>

export const AdminPaymentCollection = z
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
    paymentSessions: z.array(AdminPaymentSession).optional(),
    payments: z.array(AdminPayment).optional(),
    ...timestamps.shape,
  })
  .openapi('AdminPaymentCollection')
export type AdminPaymentCollection = z.input<typeof AdminPaymentCollection>

export const AdminRefundReason = z
  .object({
    id: z.string(),
    label: z.string(),
    code: z.string(),
    description: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    ...timestamps.shape,
  })
  .openapi('AdminRefundReason')
export type AdminRefundReason = z.input<typeof AdminRefundReason>
