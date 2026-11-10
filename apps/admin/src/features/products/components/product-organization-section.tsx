import { Trans, useLingui } from '@lingui/react/macro'
import { Card, CardAction, CardHeader, CardTitle } from '@proteus/ui'
import { PencilIcon } from 'lucide-react'
import type { AdminGroupedProduct } from '#/api/generated/model'
import { ActionMenu } from '#/components/common/action-menu'
import { SectionRow } from '#/components/common/section-row'

export function ProductOrganizationSection({ product }: { product: AdminGroupedProduct }) {
  const { t } = useLingui()
  const categories = product.categories.map((category) => category.name).join(', ')

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
      <SectionRow title={t`Categories`} value={categories || '-'} />
    </Card>
  )
}
