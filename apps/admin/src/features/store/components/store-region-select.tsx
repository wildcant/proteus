import { Trans, useLingui } from '@lingui/react/macro'
import { Field, FieldDescription, FieldLabel } from '@proteus/ui'
import { useId } from 'react'
import { TranslatedFieldError } from '#/components/form/field-errors'
import { SingleSelectCombobox } from '#/components/single-select-combobox'
import { useRegions } from '#/features/regions/api/regions'

type StoreRegionSelectProps = {
  value: string | null
  onChange: (regionId: string | null) => void
  errors?: readonly unknown[]
}

/**
 * The region a shopper is served from before they pick one.
 *
 * Chosen from the regions that exist, because the API refuses any other id: `store.default_region_id`
 * carries no foreign key across the module boundary, so a free-text field here would let a merchant
 * store a default that resolves to nothing and only find out from an empty storefront.
 *
 * Clearable, because "no default" is a state a merchant can want and one an optional field alone
 * cannot express — the API reads a cleared value as `null` and an untouched one as unchanged.
 */
export function StoreRegionSelect({ value, onChange, errors }: StoreRegionSelectProps) {
  const { t } = useLingui()
  const { data, isPending } = useRegions()
  const id = useId()
  const isInvalid = !!errors?.length

  const items = (data?.regions ?? []).map((region) => ({ id: region.id, label: region.name }))

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={id}>
        <Trans>Default region</Trans>
      </FieldLabel>
      <SingleSelectCombobox
        id={id}
        items={items}
        value={value}
        onValueChange={onChange}
        disabled={isPending}
        placeholder={t`Select a region`}
        emptyMessage={t`No regions found.`}
        aria-invalid={isInvalid}
      />
      {!!isInvalid && <TranslatedFieldError errors={errors} />}
      {!isPending && items.length === 0 && (
        <FieldDescription>
          <Trans>Create a region before choosing the one shoppers are served from.</Trans>
        </FieldDescription>
      )}
    </Field>
  )
}
