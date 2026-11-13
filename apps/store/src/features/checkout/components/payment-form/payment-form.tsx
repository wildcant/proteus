import { Trans } from '@lingui/react/macro'
import type { StorePaymentProvider } from '@proteus/http-schemas/store'
import { cn } from '@proteus/ui-core'
import { Fragment } from 'react'
import { TranslatedFieldError } from '#/components/form/field-errors'
import { PaymentRow } from '#/components/store/payment-row/payment-row'
import { paymentRowContent } from '#/components/store/payment-row/payment-row.variants'
import { FieldGroup, FieldSet } from '#/components/ui/field/field'
import { FieldLabel } from '#/components/ui/field-label/field-label'
import { RadioGroup } from '#/components/ui/radio-group/radio-group'
import { RadioGroupItem } from '#/components/ui/radio-group-item/radio-group-item'
import { Skeleton } from '#/components/ui/skeleton/skeleton'
import { usePaymentProviders } from '#/features/checkout/api/checkout'
import { ActiveProviderPanel, SoleProvider } from '#/features/checkout/components/payment/provider-panels'
import {
  paymentForm,
  paymentFormChoice,
  paymentFormDetails,
  paymentFormName,
  paymentFormProvider,
  paymentFormRadioGroupItem,
  paymentFormTestOnly,
} from '#/features/checkout/components/payment-form/payment-form.variants'
import { TestOnlyNotice } from '#/features/checkout/components/test-only-notice/test-only-notice'
import type { CheckoutData } from '#/features/checkout/hooks/use-checkout-data'
import { checkoutFormOpts } from '#/features/checkout/hooks/use-checkout-form'
import { resolvePaymentAdapter } from '#/features/checkout/utils/payment/registry'
import { withForm } from '#/lib/form-hook'

type PaymentFormProps = Pick<CheckoutData, 'cart' | 'customer'> & { className?: string }

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
  render: function PaymentForm({ form, cart, customer, className }) {
    // Scoped to the cart: the list is the methods this cart's market offers, so it is keyed by the
    // cart the same way the shipping options are.
    const { data, isLoading } = usePaymentProviders(cart.id)

    if (isLoading) {
      return <Skeleton className="h-14 w-full" />
    }

    const providers = data?.paymentProviders ?? []
    if (providers.length === 0) {
      return (
        <p className="m-0 text-ink-muted text-sm">
          <Trans>No payment providers available.</Trans>
        </p>
      )
    }

    return (
      <FieldGroup className={className}>
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
                    className={cn(paymentForm(), 'gap-0')}
                    name={field.name}
                    value={field.state.value}
                    onValueChange={(providerId: string) => field.handleChange(providerId)}
                  >
                    {providers.map((provider) => (
                      <Fragment key={provider.id}>
                        <PaymentRow
                          state={providerRowState(provider, field.state.value)}
                          className={paymentFormProvider()}
                        >
                          <div className={cn(paymentRowContent(), 'min-w-0')}>
                            <div className={cn(paymentFormDetails(), 'min-w-0')}>
                              {/* `self-stretch`: the label is the hit area, across the row. */}
                              <FieldLabel className={cn(paymentFormChoice(), 'cursor-pointer self-stretch')}>
                                <RadioGroupItem value={provider.id} className={paymentFormRadioGroupItem()} />
                                <span className={paymentFormName()}>{provider.label}</span>
                              </FieldLabel>
                              {!!provider.isTestOnly && <TestOnlyNotice className={paymentFormTestOnly()} />}
                            </div>
                          </div>
                        </PaymentRow>
                        {provider.id === field.state.value && (
                          <ActiveProviderPanel provider={provider} cart={cart} customer={customer} />
                        )}
                      </Fragment>
                    ))}
                  </RadioGroup>
                )}

                {!!isInvalid && (
                  <TranslatedFieldError errors={field.state.meta.errors} values={field.form.state.values} />
                )}
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
