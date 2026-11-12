import { useLingui } from '@lingui/react/macro'
import { SingleComboboxField } from '#/components/form/single-combobox-field'
import { useCreateProductType, useSuspenseAllProductTypes } from '#/features/product-types/api/product-types'
import { toValueOption } from '#/lib/value-option'

/**
 * The product form's Type: a single choice over every Type, whose "Add <value>" creates one on the
 * spot. Rendered inside the `form.AppField` that holds the chosen item.
 */
export function ProductTypeCombobox({ description }: { description?: string }) {
  const { t } = useLingui()
  const { data: types } = useSuspenseAllProductTypes()
  const { mutate: createType } = useCreateProductType()

  return (
    <SingleComboboxField
      label={t`Type`}
      items={types.map(toValueOption)}
      onCreate={(value, choose) => createType({ value }, { onSuccess: ({ type }) => choose(toValueOption(type)) })}
      placeholder={t`Search or add a type`}
      emptyMessage={t`Type to add one.`}
      description={description}
    />
  )
}
