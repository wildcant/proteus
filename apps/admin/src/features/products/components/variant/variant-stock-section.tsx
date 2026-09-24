import { Trans, useLingui } from '@lingui/react/macro'
import { Card, CardAction, CardHeader, CardTitle } from '@proteus/ui'
import { PencilIcon } from 'lucide-react'
import type { AdminProductVariantResponseVariant } from '#/api/generated/model'
import { ActionMenu } from '#/components/common/action-menu'
import { SectionRow } from '#/components/common/section-row'

export function VariantStockSection({ variant }: { variant: AdminProductVariantResponseVariant }) {
  const { t } = useLingui()
  const stock = variant.stock

  if (!variant.manageInventory) {
    return (
      <Card className="gap-0 divide-y py-0">
        <CardHeader>
          <CardTitle>
            <Trans>Stock</Trans>
          </CardTitle>
          <CardAction>
            <ActionMenu groups={[{ actions: [{ label: t`Edit variant`, to: './edit', icon: <PencilIcon /> }] }]} />
          </CardAction>
        </CardHeader>
        <p className="px-6 py-4 text-muted-foreground text-sm">
          <Trans>
            Inventory is not managed for this variant. Turn on &lsquo;Manage Inventory&rsquo; to track the variant's
            inventory.
          </Trans>
        </p>
      </Card>
    )
  }

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>
          <Trans>Stock</Trans>
        </CardTitle>
        <CardAction>
          <ActionMenu groups={[{ actions: [{ label: t`Edit stock`, to: './stock', icon: <PencilIcon /> }] }]} />
        </CardAction>
      </CardHeader>
      <SectionRow title={t`Stocked quantity`} value={stock ? String(stock.stockedQuantity) : '—'} />
      <SectionRow title={t`Reserved quantity`} value={stock ? String(stock.reservedQuantity) : '—'} />
      <SectionRow title={t`Available quantity`} value={stock ? String(stock.availableQuantity) : '—'} />
    </Card>
  )
}
