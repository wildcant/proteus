import { msg } from '@lingui/core/macro'
import { AdminAddDraftOrderItems } from '@proteus/http-schemas/admin'
import { z } from 'zod'
import type { AdminDraftOrderResponse } from '#/api/generated/model'
import type { ComboboxOption } from '#/components/form/single-combobox-field'
import { useAddDraftOrderItems } from '#/features/draft-orders/api/draft-orders'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

const pickOne = (message: string) =>
  z
    .custom<ComboboxOption>()
    .nullable()
    .refine((option) => option !== null, { message })

const quantityMessage = msg`Enter a quantity of 1 or more.`.id

// Hand-written: the route's body is a batch of variant ids, while the drawer picks a product and
// then one of its variants, as two choices. The payload goes through the route's schema at submit.
const addDraftItemSchema = z.object({
  product: pickOne(msg`Pick a product.`.id),
  variant: pickOne(msg`Pick a variant.`.id),
  quantity: z
    .number()
    .int({ message: quantityMessage })
    .min(1, { message: quantityMessage })
    .nullable()
    .refine((quantity) => quantity !== null, { message: quantityMessage }),
})

export type AddDraftItemFormParams = SubmitFormParams<AdminDraftOrderResponse>

export function useAddDraftItemForm(draftOrderId: string, params?: AddDraftItemFormParams) {
  const addMutation = useAddDraftOrderItems(draftOrderId)

  // `z.input`: the choices start empty, which the schema's output refuses.
  const defaultValues: z.input<typeof addDraftItemSchema> = { product: null, variant: null, quantity: 1 }

  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: addDraftItemSchema },
    onSubmit: async ({ value }) => {
      try {
        const data = await addMutation.mutateAsync(
          AdminAddDraftOrderItems.parse({ items: [{ variantId: value.variant?.id, quantity: value.quantity }] }),
        )
        form.reset()
        params?.onSuccess?.(data)
      } catch (error) {
        params?.onError?.(errorMessage(error))
      } finally {
        params?.onSettled?.()
      }
    },
  })

  return { form }
}
