import { BigNumber } from '@core/db/bignum.js'
import type {
  CreateAccountHolderDTO,
  CreatePaymentCollectionDTO,
  CreatePaymentSessionDTO,
  CreateRefundReasonDTO,
  UpdatePaymentCollectionDTO,
  UpdateRefundReasonDTO,
} from '@core/types/payment/mutations.js'

export function generateCreatePaymentCollectionDTO(
  overrides?: Partial<CreatePaymentCollectionDTO>,
): CreatePaymentCollectionDTO {
  return {
    amount: new BigNumber(10000),
    ...overrides,
  }
}

export function generateUpdatePaymentCollectionDTO(
  overrides?: Partial<UpdatePaymentCollectionDTO>,
): UpdatePaymentCollectionDTO {
  return {
    ...overrides,
  }
}

export function generateCreatePaymentSessionDTO(overrides?: Partial<CreatePaymentSessionDTO>): CreatePaymentSessionDTO {
  return {
    providerId: 'system',
    amount: new BigNumber(10000),
    ...overrides,
  }
}

export function generateCreateRefundReasonDTO(overrides?: Partial<CreateRefundReasonDTO>): CreateRefundReasonDTO {
  return {
    label: 'Defective product',
    code: 'defective',
    ...overrides,
  }
}

export function generateUpdateRefundReasonDTO(overrides?: Partial<UpdateRefundReasonDTO>): UpdateRefundReasonDTO {
  return {
    ...overrides,
  }
}

export function generateCreateAccountHolderDTO(overrides?: Partial<CreateAccountHolderDTO>): CreateAccountHolderDTO {
  return {
    providerId: 'system',
    externalId: `ext_${Math.random().toString(36).slice(2)}`,
    email: 'test@example.com',
    ...overrides,
  }
}
