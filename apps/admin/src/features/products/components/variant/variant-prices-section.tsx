import { Trans, useLingui } from '@lingui/react/macro'
import { Card, CardAction, CardHeader, CardTitle } from '@proteus/ui'
import { formatPrice } from '@proteus/utils'
import { PencilIcon } from 'lucide-react'
import type { AdminProductVariant, AdminVariantPrice } from '#/api/generated/model'
import { ActionMenu } from '#/components/common/action-menu'
import { SectionRow } from '#/components/common/section-row'
import { useStoreCurrencies } from '#/features/store/api/store'
import { activeLocale } from '#/lib/i18n/locale'

export function VariantPricesSection({ variant }: { variant: AdminProductVariant }) {
  const { t } = useLingui()
  const { currencyCodes } = useStoreCurrencies()
  const priceByCurrency = new Map((variant.prices ?? []).map((price) => [price.currencyCode, price]))

  // The compare-at shows as stored, at or below the price too: the storefront hides one that makes
  // no Markdown, but the merchant still has to see what they typed to correct it.
  const priceLine = (price: AdminVariantPrice): string => {
    const amount = formatPrice(price.amount, price.currencyCode, activeLocale())
    if (price.compareAtAmount === null) return amount
    const compareAt = formatPrice(price.compareAtAmount, price.currencyCode, activeLocale())
    return `${amount}\n${t`Compare-at ${compareAt}`}`
  }

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>
          <Trans>Prices</Trans>
        </CardTitle>
        <CardAction>
          <ActionMenu groups={[{ actions: [{ label: t`Edit prices`, to: './prices', icon: <PencilIcon /> }] }]} />
        </CardAction>
      </CardHeader>
      {/* One row per store currency, priced or not — a market this variant cannot be sold in is
          worth seeing, and `SectionRow` already renders an absent value as `-`. */}
      {currencyCodes.map((currencyCode) => {
        const price = priceByCurrency.get(currencyCode)
        return <SectionRow key={currencyCode} title={currencyCode.toUpperCase()} value={price && priceLine(price)} />
      })}
    </Card>
  )
}
