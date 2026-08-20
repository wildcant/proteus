import { BigNumber } from '@core/db/bignum.js'
import type { PaymentDTO, PaymentSessionDTO } from '@core/types/payment/common.js'
import type {
  CreateAccountHolderDTO,
  CreatePaymentCollectionDTO,
  CreatePaymentSessionDTO,
  CreateRefundReasonDTO,
  UpdatePaymentCollectionDTO,
  UpdateRefundReasonDTO,
} from '@core/types/payment/mutations.js'
import { faker } from '@faker-js/faker'

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

export function generatePaymentSessionDTO(overrides?: Partial<PaymentSessionDTO>): PaymentSessionDTO {
  return {
    id: `payses_${faker.string.alphanumeric(32)}`,
    paymentCollectionId: `paycol_${faker.string.alphanumeric(32)}`,
    providerId: faker.helpers.arrayElement(['system', 'stripe']),
    currencyCode: faker.finance.currencyCode().toLowerCase(),
    amount: new BigNumber(faker.number.int({ min: 100, max: 100000 })),
    status: faker.helpers.arrayElement<PaymentSessionDTO['status']>(['pending', 'authorized', 'captured']),
    data: {},
    context: null,
    authorizedAt: null,
    metadata: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export function generatePaymentDTO(overrides?: Partial<PaymentDTO>): PaymentDTO {
  return {
    id: `pay_${faker.string.alphanumeric(32)}`,
    paymentCollectionId: `paycol_${faker.string.alphanumeric(32)}`,
    paymentSessionId: `payses_${faker.string.alphanumeric(32)}`,
    amount: new BigNumber(faker.number.int({ min: 100, max: 100000 })),
    currencyCode: faker.finance.currencyCode().toLowerCase(),
    providerId: faker.helpers.arrayElement(['system', 'stripe']),
    data: null,
    metadata: null,
    capturedAt: null,
    canceledAt: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
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
