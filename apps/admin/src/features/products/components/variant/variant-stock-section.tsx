import { Card, CardAction, CardHeader, CardTitle } from '@proteus/ui'
import { PencilIcon } from 'lucide-react'
import type { AdminProductVariantResponseVariant } from '#/api/generated/model'
import { ActionMenu } from '#/components/common/action-menu'
import { SectionRow } from '#/components/common/section-row'

export function VariantStockSection({ variant }: { variant: AdminProductVariantResponseVariant }) {
  const stock = variant.stock

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>Stock</CardTitle>
        {variant.manageInventory ? (
          <CardAction>
            <ActionMenu groups={[{ actions: [{ label: 'Edit stock', to: './stock', icon: <PencilIcon /> }] }]} />
          </CardAction>
        ) : null}
      </CardHeader>
      <SectionRow title="Stocked quantity" value={stock ? String(stock.stockedQuantity) : '—'} />
      <SectionRow title="Reserved quantity" value={stock ? String(stock.reservedQuantity) : '—'} />
      <SectionRow title="Available quantity" value={stock ? String(stock.availableQuantity) : '—'} />
    </Card>
  )
}
