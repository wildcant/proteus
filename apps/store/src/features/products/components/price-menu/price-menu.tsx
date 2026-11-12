import { useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { Form } from '#/components/form/form'
import { Popover, PopoverContent } from '#/components/ui/popover/popover'
import { FilterTrigger } from '#/features/products/components/filter-trigger/filter-trigger'
import {
  priceMenu,
  priceMenuApply,
  priceMenuForm,
  priceMenuFrom,
  priceMenuRange,
  priceMenuTo,
} from '#/features/products/components/price-menu/price-menu.variants'
import { type PriceRange, usePriceRangeForm } from '#/features/products/hooks/use-price-range-form'
import { useFormatters } from '#/hooks/use-formatters'
import { useMarket } from '#/hooks/use-market'

/** The price range, two amounts in the market's currency, either left empty to leave that end open. */
export function PriceMenu({
  minPrice,
  maxPrice,
  onApply,
  className,
}: PriceRange & { onApply: (range: PriceRange) => void; className?: string }) {
  const { t } = useLingui()
  const { current } = useMarket()
  const { formatPrice } = useFormatters()
  const [open, setOpen] = useState(false)
  const { form } = usePriceRangeForm({ minPrice, maxPrice }, (range) => {
    onApply(range)
    setOpen(false)
  })
  const format = (amount: number) => formatPrice(String(amount), current.currencyCode)
  const hasPrice = minPrice !== undefined || maxPrice !== undefined

  const label = (() => {
    if (minPrice !== undefined && maxPrice !== undefined) return t`Price: ${format(minPrice)} – ${format(maxPrice)}`
    if (minPrice !== undefined) return t`Price: from ${format(minPrice)}`
    if (maxPrice !== undefined) return t`Price: up to ${format(maxPrice)}`
    return t`Price`
  })()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <FilterTrigger chosen={hasPrice} className={className}>
        {label}
      </FilterTrigger>
      <PopoverContent align="start" aria-label={t`Price`} className={priceMenu()}>
        <Form onSubmit={form.handleSubmit} className={priceMenuForm()}>
          <form.AppForm>
            <div className={priceMenuRange()}>
              <form.AppField name="minPrice">
                {(field) => <field.TextField label={t`From`} type="number" className={priceMenuFrom()} />}
              </form.AppField>
              <form.AppField name="maxPrice">
                {(field) => <field.TextField label={t`To`} type="number" className={priceMenuTo()} />}
              </form.AppField>
            </div>
            <form.SubmitButton className={priceMenuApply()}>{t`Apply`}</form.SubmitButton>
          </form.AppForm>
        </Form>
      </PopoverContent>
    </Popover>
  )
}
