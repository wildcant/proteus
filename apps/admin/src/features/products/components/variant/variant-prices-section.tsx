import { Card, CardAction, CardHeader, CardTitle, formatPrice } from '@proteus/ui'
import { PencilIcon } from 'lucide-react'
import type { AdminProductVariant } from '#/api/generated/model'
import { ActionMenu } from '#/components/common/action-menu'
import { SectionRow } from '#/components/common/section-row'

export function VariantPricesSection({ variant }: { variant: AdminProductVariant }) {
  const prices = variant.prices ?? []
  const usdPrice = prices.find((price) => price.currencyCode === 'usd')

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>Prices</CardTitle>
        <CardAction>
          <ActionMenu groups={[{ actions: [{ label: 'Edit prices', to: './prices', icon: <PencilIcon /> }] }]} />
        </CardAction>
      </CardHeader>
      <SectionRow title="USD" value={usdPrice ? formatPrice(usdPrice.amount, usdPrice.currencyCode) : '-'} />
    </Card>
  )
}
