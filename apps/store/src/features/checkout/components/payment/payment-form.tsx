import type { StorePaymentProvider } from '@proteus/http-schemas/store'
import { cn, FieldError, FieldGroup, FieldLabel, FieldSet, RadioGroup, RadioGroupItem, Skeleton } from '@proteus/ui'
import { Fragment } from 'react'
import { ROW_CLASS, ROW_OPEN_CLASS, ROW_SELECTED_CLASS } from '#/features/account/payment-methods/row'
import { usePaymentProviders } from '#/features/checkout/api/checkout'
import { withForm } from '#/lib/form-hook'
import type { CheckoutData } from '../../hooks/use-checkout-data'
import { checkoutFormOpts } from '../../hooks/use-checkout-form'
import { resolvePaymentAdapter } from '../../payment/registry'
import { ActiveProviderPanel, SoleProvider, TestOnlyNotice } from './provider-panels'

type PaymentFormProps = Pick<CheckoutData, 'cart' | 'customer'>

/**
 * How a provider row is drawn, which depends on whether the choice ends there.
 *
 * A provider with no client adapter — the system provider takes no card details — *is* the
 * selection, so it carries the ink border. One that opens its own surface is only the way in to
 * the real choice, and the row beneath it is what gets bordered.
 */
function providerRowState(provider: StorePaymentProvider, chosenId: string): string | false {
  if (provider.id !== chosenId) return false
  return resolvePaymentAdapter(provider.id) ? ROW_OPEN_CLASS : ROW_SELECTED_CLASS
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
            const [soleProvider] = providers

            return (
              <FieldSet>
                {/* A single provider is not a choice, so it is not offered as one. */}
                {soleProvider && providers.length === 1 ? (
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
                        <div className={cn(ROW_CLASS, providerRowState(provider, field.state.value))}>
                          <div className="flex min-w-0 flex-1 flex-col gap-2">
                            <FieldLabel className="flex cursor-pointer items-center gap-3">
                              <RadioGroupItem value={provider.id} />
                              <span className="font-medium text-ink text-sm">{provider.label}</span>
                            </FieldLabel>
                            {!!provider.isTestOnly && <TestOnlyNotice />}
                          </div>
                        </div>
                        {provider.id === field.state.value && (
                          <ActiveProviderPanel provider={provider} cart={cart} customer={customer} />
                        )}
                      </Fragment>
                    ))}
                  </RadioGroup>
                )}

                {!!isInvalid && <FieldError errors={field.state.meta.errors} />}
                {/* Only for the sole-provider render, which draws no rows to open beneath. */}
                {!!selected && providers.length === 1 && (
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
