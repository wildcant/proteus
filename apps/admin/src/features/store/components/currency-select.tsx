import { Trans, useLingui } from '@lingui/react/macro'
import { Field } from '@proteus/ui'
import { getCurrencyName } from '@proteus/utils'
import { TranslatedFieldError } from '#/components/form/field-errors'
import { MultiSelectCombobox } from '#/components/multi-select-combobox'
import { useStoreCurrencies } from '#/features/store/api/store'
import { selectableCurrencyCodes } from '#/features/store/utils/store-currencies'
import { activeLocale } from '#/lib/i18n/locale'

type CurrencySelectProps = {
  value: string[]
  onChange: (currencyCodes: string[]) => void
  errors?: readonly unknown[]
}

/**
 * The currencies to start trading in — every ISO 4217 code the runtime can name, minus the ones
 * the store already holds.
 *
 * Searchable rather than paged, because a merchant looking for the Colombian peso types "cop" and
 * has to find it; there are only ~160 codes, so the whole list is one field.
 */
export function CurrencySelect({ value, onChange, errors }: CurrencySelectProps) {
  const { t } = useLingui()
  const { currencyCodes, isPending } = useStoreCurrencies()
  const locale = activeLocale()
  const isInvalid = !!errors?.length
  // The same `CODE — Name` shape the region editor's currency field offers, so a merchant reads
  // the two lists the same way.
  const items = selectableCurrencyCodes(currencyCodes).map((code) => ({
    id: code,
    label: `${code.toUpperCase()} — ${getCurrencyName(code, locale)}`,
  }))

  return (
    <Field data-invalid={isInvalid}>
      <h2 className="font-medium text-sm">
        <Trans>Currencies</Trans>
      </h2>
      <p className="mb-3 text-muted-foreground text-sm">
        <Trans>
          Adding a currency is what gives every product a price column in it. Only currencies the store does not already
          sell in are offered.
        </Trans>
      </p>
      <MultiSelectCombobox
        items={items}
        value={value}
        onValueChange={onChange}
        placeholder={t`Search currencies...`}
        emptyMessage={isPending ? t`Loading currencies…` : t`No currencies left to add.`}
      />
      {isInvalid && <TranslatedFieldError errors={errors} />}
    </Field>
  )
}
