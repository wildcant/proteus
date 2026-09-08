import { Field, FieldError, getCurrencyName } from '@proteus/ui'
import { MultiSelectCombobox } from '#/components/multi-select-combobox'
import { useStoreCurrencies } from '#/features/store/api/store'
import { selectableCurrencyCodes } from '#/features/store/utils/store-currencies'

type CurrencySelectProps = {
  value: string[]
  onChange: (currencyCodes: string[]) => void
  errors?: Array<{ message?: string } | undefined>
}

/**
 * The currencies to start trading in — every ISO 4217 code the runtime can name, minus the ones
 * the store already holds.
 *
 * Searchable rather than paged, because a merchant looking for the Colombian peso types "cop" and
 * has to find it; there are only ~160 codes, so the whole list is one field.
 */
export function CurrencySelect({ value, onChange, errors }: CurrencySelectProps) {
  const { currencyCodes, isPending } = useStoreCurrencies()
  const isInvalid = !!errors?.length
  // The same `CODE — Name` shape the region editor's currency field offers, so a merchant reads
  // the two lists the same way.
  const items = selectableCurrencyCodes(currencyCodes).map((code) => ({
    id: code,
    label: `${code.toUpperCase()} — ${getCurrencyName(code)}`,
  }))

  return (
    <Field data-invalid={isInvalid}>
      <h2 className="font-medium text-sm">Currencies</h2>
      <p className="mb-3 text-muted-foreground text-sm">
        Adding a currency is what gives every product a price column in it. Only currencies the store does not already
        sell in are offered.
      </p>
      <MultiSelectCombobox
        items={items}
        value={value}
        onValueChange={onChange}
        placeholder="Search currencies..."
        emptyMessage={isPending ? 'Loading currencies…' : 'No currencies left to add.'}
      />
      {isInvalid && <FieldError errors={errors} />}
    </Field>
  )
}
