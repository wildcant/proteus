import type { CreatePaymentSessionBody } from '@proteus/http-schemas/store'
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet, RadioGroup, RadioGroupItem, Skeleton } from '@proteus/ui'
import { InfoIcon } from 'lucide-react'
import type { CreateStorePaymentCollectionBody } from '#/api/generated/model'
import {
  useCreatePaymentCollection,
  useCreatePaymentSession,
  usePaymentProviders,
} from '#/features/checkout/api/checkout'
import type { SubmitFormParams } from '#/lib/form'
import { withForm } from '#/lib/form-hook'
import type { CheckoutData } from '../../hooks/use-checkout-data'
import { checkoutFormOpts } from '../../hooks/use-checkout-form'

type PaymentFormProps = Pick<CheckoutData, 'cart'>
export const PaymentForm = withForm({
  ...checkoutFormOpts,
  props: {} as PaymentFormProps,
  render: function PaymentForm({ form, cart }) {
    const { data, isLoading } = usePaymentProviders()
    const { createPaymentSession } = usePaymentSession({
      collectionValues: { cartId: cart.id },
    })
    if (isLoading) {
      return <Skeleton className="h-14 w-full" />
    }

    const providers = data?.paymentProviders ?? []
    if (providers.length === 0) {
      return <p className="m-0 text-ink-muted text-sm">No payment providers available.</p>
    }

    return (
      <FieldGroup>
        <form.Field name="paymentProviderId">
          {(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
            return (
              <FieldSet>
                <RadioGroup
                  name={field.name}
                  value={field.state.value}
                  onValueChange={(providerId: string) => {
                    field.handleChange(providerId)
                    createPaymentSession({ providerId })
                  }}
                  disabled={isLoading}
                >
                  {providers.map((provider) => (
                    <Field key={provider.id} orientation="horizontal">
                      <FieldLabel className="flex w-full cursor-pointer flex-col items-start gap-2 border border-line p-4 has-data-checked:border-ink has-data-checked:bg-transparent has-data-checked:ring-1 has-data-checked:ring-ink has-data-checked:ring-inset">
                        <span className="flex items-center gap-3">
                          <RadioGroupItem value={provider.id} />
                          <span className="font-medium text-ink text-sm">{provider.label}</span>
                        </span>
                        {!!provider.isTestOnly && (
                          <span className="flex w-full items-start gap-2 bg-surface-subtle px-3 py-1.5 text-ink-muted text-xs">
                            <InfoIcon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            For testing purposes only. No payment is taken.
                          </span>
                        )}
                      </FieldLabel>
                    </Field>
                  ))}
                </RadioGroup>
                {!!isInvalid && <FieldError errors={field.state.meta.errors} />}
              </FieldSet>
            )
          }}
        </form.Field>
      </FieldGroup>
    )
  },
})

export type PaymentSessionParams = SubmitFormParams & {
  collectionValues: CreateStorePaymentCollectionBody
}

function usePaymentSession(params: PaymentSessionParams) {
  const createCollection = useCreatePaymentCollection()
  const createSession = useCreatePaymentSession()

  const isPending = createCollection.isPending || createSession.isPending
  const error = createCollection.error ?? createSession.error

  const createPaymentSession = async ({ providerId }: CreatePaymentSessionBody) => {
    try {
      const collection = await createCollection.mutateAsync(params.collectionValues)
      await createSession.mutateAsync({
        collectionId: collection.paymentCollection.id,
        providerId: providerId,
      })
      params.onSuccess?.()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Payment setup failed'
      params.onError?.(message)
    } finally {
      params.onSettled?.()
    }
  }

  return { createPaymentSession, isPending, error }
}
