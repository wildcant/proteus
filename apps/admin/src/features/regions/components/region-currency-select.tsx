import { Field, FieldDescription, FieldError, FieldLabel, getCurrencyName } from '@proteus/ui'
import { useId } from 'react'
import { SingleSelectCombobox } from '#/components/single-select-combobox'
import { useStoreCurrencies } from '#/features/store/api/store'

type RegionCurrencySelectProps = {
  value: string
  onChange: (currencyCode: string) => void
  errors?: Array<{ message?: string } | undefined>
}

/**
 * The money the region settles in, chosen from the currencies the store sells in.
 *
 * The list is the store's rather than every ISO 4217 code, because the API refuses anything else:
 * a region denominated in money the store has no prices in is a market whose products can never
 * be priced. Offering the wrong list would turn that refusal into a form error the merchant
 * cannot act on.
 */
export function RegionCurrencySelect({ value, onChange, errors }: RegionCurrencySelectProps) {
  const { currencyCodes, isPending } = useStoreCurrencies()
  const id = useId()
  const isInvalid = !!errors?.length

  const items = currencyCodes.map((currencyCode) => ({
    id: currencyCode,
    label: `${currencyCode.toUpperCase()} — ${getCurrencyName(currencyCode)}`,
  }))

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={id}>Currency</FieldLabel>
      <SingleSelectCombobox
        id={id}
        items={items}
        value={value || null}
        onValueChange={(currencyCode) => onChange(currencyCode ?? '')}
        disabled={isPending}
        placeholder="Select a currency"
        emptyMessage="No currencies found."
        aria-invalid={isInvalid}
      />
      {!!isInvalid && <FieldError errors={errors} />}
      {!isPending && items.length === 0 && (
        <FieldDescription>The store sells in no currencies yet, so a region has none to settle in.</FieldDescription>
      )}
    </Field>
  )
}
