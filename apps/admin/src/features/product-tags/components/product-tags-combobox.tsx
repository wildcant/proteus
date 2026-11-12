import { useLingui } from '@lingui/react/macro'
import { MultiComboboxField } from '#/components/form/multi-combobox-field'
import { useCreateProductTag, useSuspenseAllProductTags } from '#/features/product-tags/api/product-tags'
import { toValueOption } from '#/lib/value-option'

/**
 * The product form's Tags: a choice of several over every Tag, whose "Add <value>" creates one on the
 * spot. Rendered inside the `form.AppField` that holds the chosen ids.
 */
export function ProductTagsCombobox({ description }: { description?: string }) {
  const { t } = useLingui()
  const { data: tags } = useSuspenseAllProductTags()
  const { mutate: createTag } = useCreateProductTag()

  return (
    <MultiComboboxField
      label={t`Tags`}
      items={tags.map(toValueOption)}
      onCreate={(value, choose) => createTag({ value }, { onSuccess: ({ tag }) => choose(toValueOption(tag)) })}
      placeholder={t`Search or add tags`}
      emptyMessage={t`Type to add a tag.`}
      description={description}
    />
  )
}
