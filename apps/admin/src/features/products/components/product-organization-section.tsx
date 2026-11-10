import { Trans, useLingui } from '@lingui/react/macro'
import { Card, CardAction, CardHeader, CardTitle } from '@proteus/ui'
import { PencilIcon } from 'lucide-react'
import type { AdminGroupedProduct } from '#/api/generated/model'
import { ActionMenu } from '#/components/common/action-menu'
import { SectionRow } from '#/components/common/section-row'
import { useSuspenseCategoryTree } from '#/features/categories/api/categories'
import { categoryPath, flattenCategoryTree } from '#/features/categories/utils/flatten-category-tree'

export function ProductOrganizationSection({ product }: { product: AdminGroupedProduct }) {
  const { t } = useLingui()
  const { data: tree } = useSuspenseCategoryTree()
  // Names repeat across the tree, so each Category is shown by its path, as the picker names it.
  const paths = new Map(flattenCategoryTree(tree.productCategories).map((row) => [row.category.id, categoryPath(row)]))
  const categories = product.categories.map((category) => paths.get(category.id) ?? category.name).join(', ')
  const collections = product.collections.map((collection) => collection.title).join(', ')
  const tags = product.tags.map((tag) => tag.value).join(', ')

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>
          <Trans>Organization</Trans>
        </CardTitle>
        <CardAction>
          <ActionMenu groups={[{ actions: [{ label: t`Edit`, to: './organization', icon: <PencilIcon /> }] }]} />
        </CardAction>
      </CardHeader>
      <SectionRow title={t`Type`} value={product.type?.value ?? '-'} />
      <SectionRow title={t`Categories`} value={categories || '-'} />
      <SectionRow title={t`Collections`} value={collections || '-'} />
      <SectionRow title={t`Tags`} value={tags || '-'} />
    </Card>
  )
}
