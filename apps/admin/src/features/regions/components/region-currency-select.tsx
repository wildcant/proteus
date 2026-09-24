import { Trans, useLingui } from '@lingui/react/macro'
import { Field, FieldDescription, FieldLabel } from '@proteus/ui'
import { getCurrencyName } from '@proteus/utils'
import { useId } from 'react'
import { TranslatedFieldError } from '#/components/form/field-errors'
import { SingleSelectCombobox } from '#/components/single-select-combobox'
import { useStoreCurrencies } from '#/features/store/api/store'
import { activeLocale } from '#/lib/i18n/locale'

type RegionCurrencySelectProps = {
  value: string
  onChange: (currencyCode: string) => void
  errors?: readonly unknown[]
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
  const { t } = useLingui()
  const { currencyCodes, isPending } = useStoreCurrencies()
  const locale = activeLocale()
  const id = useId()
  const isInvalid = !!errors?.length

  const items = currencyCodes.map((currencyCode) => ({
    id: currencyCode,
    label: `${currencyCode.toUpperCase()} — ${getCurrencyName(currencyCode, locale)}`,
  }))

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={id}>
        <Trans>Currency</Trans>
      </FieldLabel>
      <SingleSelectCombobox
        id={id}
        items={items}
        value={value || null}
        onValueChange={(currencyCode) => onChange(currencyCode ?? '')}
        disabled={isPending}
        placeholder={t`Select a currency`}
        emptyMessage={t`No currencies found.`}
        aria-invalid={isInvalid}
      />
      {!!isInvalid && <TranslatedFieldError errors={errors} />}
      {!isPending && items.length === 0 && (
        <FieldDescription>
          <Trans>The store sells in no currencies yet, so a region has none to settle in.</Trans>
        </FieldDescription>
      )}
    </Field>
  )
}
