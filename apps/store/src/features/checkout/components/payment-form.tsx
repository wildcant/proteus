import { Field, FieldLabel, RadioGroup, RadioGroupItem, Skeleton } from '@proteus/ui'
import { CreditCardIcon } from 'lucide-react'
import { Button } from '#/components/button'
import { Form } from '#/components/form/form.tsx'
import { usePaymentProviders } from '#/features/checkout/api/checkout'
import { usePaymentForm } from '#/features/checkout/hooks/use-payment-form'

type PaymentFormProps = {
  cartId: string
  onComplete: () => void
}

export function PaymentForm({ cartId, onComplete }: PaymentFormProps) {
  const { data, isLoading } = usePaymentProviders()
  const { form, isPending, error } = usePaymentForm({
    collectionValues: { cartId },
    onSuccess: onComplete,
  })

  const providers = data?.paymentProviders ?? []

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-14 w-full" />
      </div>
    )
  }

  if (providers.length === 0) {
    return <p className="text-(--foreground-muted) text-sm">No payment providers available.</p>
  }

  return (
    <Form onSubmit={form.handleSubmit}>
      <form.AppField name="providerId">
        {(field) => (
          <RadioGroup value={field.state.value} onValueChange={(value) => field.handleChange(value)}>
            {providers.map((provider) => (
              <Field key={provider.id} orientation="horizontal" className="cursor-pointer">
                <FieldLabel className="flex w-full cursor-pointer flex-col items-start gap-2 rounded-lg border border-border p-4 has-data-checked:border-primary has-data-checked:bg-primary/5">
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value={provider.id} />
                      <span className="font-medium text-foreground text-sm">{provider.label}</span>
                    </div>
                    <CreditCardIcon className="h-5 w-5 text-foreground-muted" />
                  </div>
                  {!!provider.isTestOnly && (
                    <p className="w-full rounded bg-amber-50 px-3 py-1.5 text-amber-700 text-xs">
                      Attention: For testing purposes only.
                    </p>
                  )}
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>
        )}
      </form.AppField>

      <Button type="submit" disabled={isPending} className="mt-6">
        {isPending ? 'Setting up payment...' : 'Continue to review'}
      </Button>

      {!!error && <p className="mt-2 text-red-600 text-sm">{error.message}</p>}
    </Form>
  )
}
