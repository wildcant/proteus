import { msg } from '@lingui/core/macro'
import { AdminSetDraftOrderShippingMethod } from '@proteus/http-schemas/admin'
import BigNumber from 'bignumber.js'
import { z } from 'zod'
import type {
  AdminDraftOrderResponseDraftOrder,
  AdminSetDraftOrderShippingMethod as AdminSetDraftOrderShippingMethodPayload,
} from '#/api/generated/model'
import type { ComboboxOption } from '#/components/form/single-combobox-field'

export type DraftShippingValues = {
  shippingOption: ComboboxOption | null
  /** Empty leaves the price to the option; anything else is what the shop agreed in the chat. */
  customAmount: string
}

const mustPickOption = msg`Pick a shipping option.`.id
const mustNotBeNegative = msg`Enter an amount of zero or more.`.id

export const draftShippingSchema = z.object({
  shippingOption: z
    .custom<ComboboxOption>()
    .nullable()
    .refine((option) => option !== null, { message: mustPickOption }),
  customAmount: z.union([
    z.literal(''),
    AdminSetDraftOrderShippingMethod.shape.customAmount
      .unwrap()
      .refine((amount) => !new BigNumber(amount).isNegative(), { message: mustNotBeNegative }),
  ]),
})

/** Opens on the draft's current method, and on its custom amount only when the shop set one. */
export function draftShippingDefaults(
  draftOrder: Pick<AdminDraftOrderResponseDraftOrder, 'shippingMethods'>,
): DraftShippingValues {
  const method = draftOrder.shippingMethods.at(0)
  if (!method?.shippingOptionId) return { shippingOption: null, customAmount: '' }

  return {
    shippingOption: { id: method.shippingOptionId, label: method.name },
    customAmount: method.isCustomAmount ? method.amount : '',
  }
}

export function draftShippingPayload(values: DraftShippingValues): AdminSetDraftOrderShippingMethodPayload {
  const customAmount = values.customAmount.trim()
  return {
    shippingOptionId: values.shippingOption?.id ?? '',
    ...(customAmount ? { customAmount } : {}),
  }
}
