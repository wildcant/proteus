import { Field, FieldError, FieldGroup, FieldLabel, FieldSet, RadioGroup, RadioGroupItem, Skeleton } from '@proteus/ui'
import { usePaymentProviders } from '#/features/checkout/api/checkout'
import { withForm } from '#/lib/form-hook'
import type { CheckoutData } from '../../hooks/use-checkout-data'
import { checkoutFormOpts } from '../../hooks/use-checkout-form'
import { ActiveProviderPanel, SoleProvider, TestOnlyNotice } from './provider-panels'

type PaymentFormProps = Pick<CheckoutData, 'cart' | 'customer'>

/**
 * The payment step.
 *
 * Selecting a provider is now pure form state. Nothing is created at any gateway until Place
 * order is pressed — see `useOpenPaymentSession`, which the place-order press is the only caller
 * of. That is the whole of the deferred-creation change on this side.
 */
export const PaymentForm = withForm({
  ...checkoutFormOpts,
  props: {} as PaymentFormProps,
  render: function PaymentForm({ form, cart, customer }) {
    const { data, isLoading } = usePaymentProviders()

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
            const selected = providers.find((provider) => provider.id === field.state.value)
            const [soleProvider] = providers

            return (
              <FieldSet>
                {/* A single provider is not a choice, so it is not offered as one. */}
                {soleProvider && providers.length === 1 ? (
                  <SoleProvider provider={soleProvider} onSelect={field.handleChange} value={field.state.value} />
                ) : (
                  <RadioGroup
                    name={field.name}
                    value={field.state.value}
                    onValueChange={(providerId: string) => field.handleChange(providerId)}
                  >
                    {providers.map((provider) => (
                      <Field key={provider.id} orientation="horizontal">
                        <FieldLabel className="flex w-full cursor-pointer flex-col items-start gap-2 border border-line p-4 has-data-checked:border-ink has-data-checked:bg-transparent has-data-checked:ring-1 has-data-checked:ring-ink has-data-checked:ring-inset">
                          <span className="flex items-center gap-3">
                            <RadioGroupItem value={provider.id} />
                            <span className="font-medium text-ink text-sm">{provider.label}</span>
                          </span>
                          {!!provider.isTestOnly && <TestOnlyNotice />}
                        </FieldLabel>
                      </Field>
                    ))}
                  </RadioGroup>
                )}

                {!!isInvalid && <FieldError errors={field.state.meta.errors} />}
                {!!selected && <ActiveProviderPanel provider={selected} cart={cart} customer={customer} />}
              </FieldSet>
            )
          }}
        </form.Field>
      </FieldGroup>
    )
  },
})
