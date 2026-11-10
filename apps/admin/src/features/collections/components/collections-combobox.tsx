import { useLingui } from '@lingui/react/macro'
import { MultiComboboxField } from '#/components/form/multi-combobox-field'
import { useSuspenseAllCollections } from '#/features/collections/api/collections'

/**
 * The product form's Collections: a choice of several over every Collection. Rendered inside the
 * `form.AppField` that holds the chosen ids.
 */
export function CollectionsCombobox({ description }: { description?: string }) {
  const { t } = useLingui()
  const { data: collections } = useSuspenseAllCollections()

  return (
    <MultiComboboxField
      label={t`Collections`}
      items={collections.map((collection) => ({ id: collection.id, label: collection.title }))}
      placeholder={t`Choose collections`}
      emptyMessage={t`No collections yet.`}
      description={description}
    />
  )
}
