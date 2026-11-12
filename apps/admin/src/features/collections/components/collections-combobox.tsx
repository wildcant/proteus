import { useLingui } from '@lingui/react/macro'
import { MultiComboboxField } from '#/components/form/multi-combobox-field'
import { useSuspenseAllCollections } from '#/features/collections/api/collections'

/**
 * The product form's hand-picked Collections: a choice of several over the Collections without a
 * rule, whose rule alone decides their products. Rendered inside the `form.AppField` that holds the
 * chosen ids.
 */
export function CollectionsCombobox({ description }: { description?: string }) {
  const { t } = useLingui()
  const { data: collections } = useSuspenseAllCollections()

  return (
    <MultiComboboxField
      label={t`Collections`}
      items={collections
        .filter((collection) => !collection.rule)
        .map((collection) => ({ id: collection.id, label: collection.title }))}
      placeholder={t`Choose collections`}
      emptyMessage={t`No collections yet.`}
      description={description}
    />
  )
}
