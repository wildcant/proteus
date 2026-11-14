import { useLingui } from '@lingui/react/macro'
import { Field, FieldDescription, FieldLabel, NativeSelect, NativeSelectOption } from '@proteus/ui'
import type { AdminProductOptionListingRole } from '#/api/generated/model'

/**
 * The part the option plays on the store's list card. Rendered inside the `form.Field` that holds it;
 * the empty choice stores `null`, no part.
 */
export function ListingRoleSelect({
  value,
  onChange,
}: {
  value: AdminProductOptionListingRole | null | undefined
  onChange: (value: AdminProductOptionListingRole | null) => void
}) {
  const { t } = useLingui()
  return (
    <Field>
      <FieldLabel htmlFor="listing-role">{t`On the list card`}</FieldLabel>
      <NativeSelect
        id="listing-role"
        value={value ?? ''}
        onChange={(event) =>
          onChange(event.target.value === '' ? null : (event.target.value as AdminProductOptionListingRole))
        }
      >
        <NativeSelectOption value="">{t`Not shown`}</NativeSelectOption>
        <NativeSelectOption value="grouping">{t`One swatch per value, with its photo (colour)`}</NativeSelectOption>
        <NativeSelectOption value="availability">{t`The values in stock (size)`}</NativeSelectOption>
      </NativeSelect>
      <FieldDescription>{t`A product shows the first option in its order for each.`}</FieldDescription>
    </Field>
  )
}
