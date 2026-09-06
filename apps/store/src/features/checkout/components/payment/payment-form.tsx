import type { StorePaymentProvider } from '@proteus/http-schemas/store'
import { FieldError, FieldGroup, FieldLabel, FieldSet, RadioGroup, RadioGroupItem, Skeleton } from '@proteus/ui'
import { Fragment } from 'react'
import { PaymentRow } from '#/components/payment-row'
import { usePaymentProviders } from '#/features/checkout/api/checkout'
import { withForm } from '#/lib/form-hook'
import type { CheckoutData } from '../../hooks/use-checkout-data'
import { checkoutFormOpts } from '../../hooks/use-checkout-form'
import { resolvePaymentAdapter } from '../../utils/payment/registry'
import { ActiveProviderPanel, SoleProvider, TestOnlyNotice } from './provider-panels'

type PaymentFormProps = Pick<CheckoutData, 'cart' | 'customer'>

/**
 * How a provider row is drawn, which depends on whether the choice ends there.
 *
 * A provider with no client adapter — the system provider takes no card details — *is* the
 * selection, so it carries the ink border. One that opens its own surface is only the way in to
 * the real choice, and the row beneath it is what gets bordered.
 */
function providerRowState(provider: StorePaymentProvider, chosenId: string): 'default' | 'open' | 'selected' {
  if (provider.id !== chosenId) return 'default'
  return resolvePaymentAdapter(provider.id) ? 'open' : 'selected'
}

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
            // Defined only on the render that draws no rows, and the trailing panel below is
            // guarded on the same value rather than on a second expression that happens to agree
            // with it today. Two Elements groups mounted at once is not a subtle thing to debug.
            const soleProvider = providers.length === 1 ? providers[0] : undefined

            return (
              <FieldSet>
                {/* A single provider is not a choice, so it is not offered as one. */}
                {soleProvider ? (
                  <SoleProvider provider={soleProvider} onSelect={field.handleChange} value={field.state.value} />
                ) : (
                  /* One flat list, one row style: the provider rows are the same row the saved
                     cards are, and the selected provider's surface opens directly beneath its own
                     row rather than below the whole group. `gap-0` because the rows collapse
                     their own hairlines against each other. */
                  <RadioGroup
                    className="gap-0"
                    name={field.name}
                    value={field.state.value}
                    onValueChange={(providerId: string) => field.handleChange(providerId)}
                  >
                    {providers.map((provider) => (
                      <Fragment key={provider.id}>
                        <PaymentRow state={providerRowState(provider, field.state.value)}>
                          <div className="flex min-w-0 flex-1 flex-col gap-2">
                            <FieldLabel className="flex cursor-pointer items-center gap-3 has-data-checked:bg-transparent">
                              <RadioGroupItem value={provider.id} />
                              <span className="font-medium text-ink text-sm">{provider.label}</span>
                            </FieldLabel>
                            {!!provider.isTestOnly && <TestOnlyNotice />}
                          </div>
                        </PaymentRow>
                        {provider.id === field.state.value && (
                          <ActiveProviderPanel provider={provider} cart={cart} customer={customer} />
                        )}
                      </Fragment>
                    ))}
                  </RadioGroup>
                )}

                {!!isInvalid && <FieldError errors={field.state.meta.errors} />}
                {/* Only for the sole-provider render, which draws no row to open beneath. */}
                {!!selected && !!soleProvider && (
                  <ActiveProviderPanel provider={selected} cart={cart} customer={customer} />
                )}
              </FieldSet>
            )
          }}
        </form.Field>
      </FieldGroup>
    )
  },
})
