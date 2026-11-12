import { Trans } from '@lingui/react/macro'
import { Field, FieldDescription, FieldLabel } from '@proteus/ui'
import { useId } from 'react'
import { useSuspenseCategoryTree } from '#/features/categories/api/categories'
import { CategoryPicker } from '#/features/categories/components/category-picker'
import { useFieldContext } from '#/lib/form-context.ts'

/**
 * The product form's hand-picked Categories, through the category picker. Rendered inside the
 * `form.AppField` that holds the chosen ids. A ruled Category is browsable but not choosable: its
 * rule alone decides its products.
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
        canChoose={(category) => !category.rule}
      />
      {!!description && <FieldDescription>{description}</FieldDescription>}
      <FieldDescription>
        <Trans>Categories with a rule list the products whose metafields match.</Trans>
      </FieldDescription>
    </Field>
  )
}
