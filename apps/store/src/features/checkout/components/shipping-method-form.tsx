import { Field, FieldLabel, formatPrice, RadioGroup, RadioGroupItem, Skeleton } from '@proteus/ui'
import { Button } from '#/components/button'
import { useShippingOptions } from '#/features/checkout/api/checkout'
import { useShippingMethodForm } from '#/features/checkout/hooks/use-shipping-method-form'

type ShippingMethodFormProps = {
  cartId: string
  currencyCode: string
  selectedMethodId?: string
  onComplete: () => void
}

export function ShippingMethodForm({ cartId, currencyCode, selectedMethodId, onComplete }: ShippingMethodFormProps) {
  const { data, isLoading } = useShippingOptions(cartId)
  const { form, isPending, error } = useShippingMethodForm({
    defaultValues: { shippingOptionId: selectedMethodId ?? '' },
    onSuccess: onComplete,
  })

  const options = data?.shippingOptions ?? []

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    )
  }

  if (options.length === 0) {
    return <p className="text-sm text-(--foreground-muted)">No shipping options available for your address.</p>
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        form.handleSubmit()
      }}
    >
      <form.AppField name="shippingOptionId">
        {(field) => (
          <RadioGroup value={field.state.value} onValueChange={(value) => field.handleChange(value)}>
            {options.map((option) => (
              <Field key={option.id} orientation="horizontal" className="cursor-pointer">
                <FieldLabel className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-border p-4 has-data-checked:border-primary has-data-checked:bg-primary/5">
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value={option.id} />
                    <span className="text-sm font-medium text-foreground">{option.name}</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {option.amount != null ? formatPrice(String(option.amount), currencyCode) : 'Calculated'}
                  </span>
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>
        )}
      </form.AppField>

      <Button type="submit" disabled={isPending} className="mt-6">
        {isPending ? 'Saving...' : 'Continue to payment'}
      </Button>

      {!!error && <p className="mt-2 text-sm text-red-600">{error.message}</p>}
    </form>
  )
}
