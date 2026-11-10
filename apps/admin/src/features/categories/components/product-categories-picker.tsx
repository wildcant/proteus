import { Trans } from '@lingui/react/macro'
import { Field, FieldDescription, FieldLabel } from '@proteus/ui'
import { useId } from 'react'
import { useSuspenseCategoryTree } from '#/features/categories/api/categories'
import { CategoryPicker } from '#/features/categories/components/category-picker'
import { useFieldContext } from '#/lib/form-context.ts'

/**
 * The product form's Categories, through the category picker. Rendered inside the `form.AppField`
 * that holds the chosen ids.
 */
export function ProductCategoriesPicker({ description }: { description?: string }) {
  const field = useFieldContext<string[]>()
  const { data: tree } = useSuspenseCategoryTree()
  const id = useId()

  return (
    <Field>
      <FieldLabel htmlFor={id}>
        <Trans>Categories</Trans>
      </FieldLabel>
      <CategoryPicker
        multiple
        id={id}
        tree={tree.productCategories}
        value={field.state.value}
        onValueChange={field.handleChange}
      />
      {!!description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  )
}
