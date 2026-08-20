import { CreatePaymentSession } from '@proteus/http-schemas/store'
import type { CreateStorePaymentCollectionBody, CreateStorePaymentSessionBody } from '#/api/generated/model'
import { useCreatePaymentCollection, useCreatePaymentSession } from '#/features/checkout/api/checkout'
import type { SubmitFormParams } from '#/lib/form'
import { useAppForm } from '#/lib/form-hook'

export type PaymentFormParams = SubmitFormParams & {
  collectionValues: CreateStorePaymentCollectionBody
  sessionValues?: CreateStorePaymentSessionBody
}

export function usePaymentForm(params: PaymentFormParams) {
  const createCollection = useCreatePaymentCollection()
  const createSession = useCreatePaymentSession()

  const isPending = createCollection.isPending || createSession.isPending
  const error = createCollection.error ?? createSession.error

  const form = useAppForm({
    defaultValues: params.sessionValues ?? { providerId: '' },
    validators: { onSubmit: CreatePaymentSession },
    onSubmit: async ({ value }) => {
      try {
        const collection = await createCollection.mutateAsync(params.collectionValues)
        await createSession.mutateAsync({
          collectionId: collection.paymentCollection.id,
          providerId: value.providerId,
        })
        params.onSuccess?.()
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Payment setup failed'
        params.onError?.(message)
      } finally {
        params.onSettled?.()
      }
    },
  })

  return { form, isPending, error }
}
