import { Card, CardAction, CardHeader, CardTitle } from '@proteus/ui'
import { formatPrice } from '@proteus/utils'
import { PencilIcon } from 'lucide-react'
import type { AdminProductVariant } from '#/api/generated/model'
import { ActionMenu } from '#/components/common/action-menu'
import { SectionRow } from '#/components/common/section-row'
import { useStoreCurrencies } from '#/features/store/api/store'

export function VariantPricesSection({ variant }: { variant: AdminProductVariant }) {
  const { currencyCodes } = useStoreCurrencies()
  const priceByCurrency = new Map((variant.prices ?? []).map((price) => [price.currencyCode, price]))

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>Prices</CardTitle>
        <CardAction>
          <ActionMenu groups={[{ actions: [{ label: 'Edit prices', to: './prices', icon: <PencilIcon /> }] }]} />
        </CardAction>
      </CardHeader>
      {/* One row per store currency, priced or not — a market this variant cannot be sold in is
          worth seeing, and `SectionRow` already renders an absent value as `-`. */}
      {currencyCodes.map((currencyCode) => {
        const price = priceByCurrency.get(currencyCode)
        return (
          <SectionRow
            key={currencyCode}
            title={currencyCode.toUpperCase()}
            value={price ? formatPrice(price.amount, price.currencyCode) : undefined}
          />
        )
      })}
    </Card>
  )
}
