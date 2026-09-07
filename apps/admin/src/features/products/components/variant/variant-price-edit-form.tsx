import { Button, KeyboundForm, RouteFocusModal, useRouteModal } from '@proteus/ui'
import { useCallback, useMemo, useState } from 'react'
import type { AdminProductVariant, AdminUpdateVariantPricesPricesItem } from '#/api/generated/model'
import { DataGrid } from '#/components/data-grid'
import { useUpdateVariantPrices } from '#/features/products/api/product-variants'
import { buildPriceColumns, type CurrencyAmounts } from '#/features/products/utils/price-columns'
import { useStoreCurrencies } from '#/features/store/api/store'

/**
 * The edit as a payload, or `undefined` when nothing changed.
 *
 * A currency left blank is omitted rather than sent as zero: the endpoint merges by currency, so
 * omitting one leaves whatever price it already has alone, and quoting zero would put a variant on
 * sale for nothing. That is also why a price the merchant never touched is safe to send — it goes
 * back with the same id and amount it arrived with.
 */
function buildPricePayload(
  initial: CurrencyAmounts,
  current: CurrencyAmounts,
  priceIdByCurrency: Map<string, string>,
): AdminUpdateVariantPricesPricesItem[] | undefined {
  const prices: AdminUpdateVariantPricesPricesItem[] = []
  let hasChanges = false

  for (const [currencyCode, amount] of Object.entries(current)) {
    if (amount !== (initial[currencyCode] ?? '')) {
      hasChanges = true
    }
    if (amount === '') continue

    const id = priceIdByCurrency.get(currencyCode)
    prices.push({ ...(id ? { id } : {}), currencyCode, amount })
  }

  return hasChanges && prices.length > 0 ? prices : undefined
}

export function VariantPriceEditForm({ productId, variant }: { productId: string; variant: AdminProductVariant }) {
  const { handleSuccess, setCloseOnEscape } = useRouteModal()
  const updatePrices = useUpdateVariantPrices(productId, variant.id)
  const { currencyCodes, isPending } = useStoreCurrencies()

  const columns = useMemo(() => buildPriceColumns(currencyCodes), [currencyCodes])

  const priceIdByCurrency = useMemo(
    () => new Map((variant.prices ?? []).map((price) => [price.currencyCode, price.id])),
    [variant.prices],
  )

  const initialRow = useMemo((): CurrencyAmounts => {
    const amountByCurrency = new Map((variant.prices ?? []).map((price) => [price.currencyCode, price.amount]))
    return Object.fromEntries(currencyCodes.map((code) => [code, amountByCurrency.get(code) ?? '']))
  }, [variant.prices, currencyCodes])

  // Null until the merchant types, so the row still picks up the store currencies when they land
  // after the first render. Seeding state from a list that is still loading would leave the grid
  // permanently one currency short.
  const [draftRow, setDraftRow] = useState<CurrencyAmounts | null>(null)
  const row = draftRow ?? initialRow

  const isDirty = useMemo(
    () => Object.entries(row).some(([currencyCode, amount]) => amount !== (initialRow[currencyCode] ?? '')),
    [row, initialRow],
  )

  const handleEditingChange = useCallback(
    (isEditing: boolean) => {
      setCloseOnEscape(!isEditing)
    },
    [setCloseOnEscape],
  )

  const handleSubmit = (event: React.SubmitEvent) => {
    event.preventDefault()
    const payload = buildPricePayload(initialRow, row, priceIdByCurrency)
    if (!payload) {
      handleSuccess()
      return
    }

    updatePrices.mutate({ prices: payload }, { onSuccess: () => handleSuccess() })
  }

  return (
    <KeyboundForm onSubmit={handleSubmit} className="flex flex-1 flex-col">
      <RouteFocusModal.Header />
      <RouteFocusModal.Body>
        <DataGrid
          data={[row]}
          columns={columns}
          onChange={(rows) => setDraftRow(rows[0] ?? initialRow)}
          onEditingChange={handleEditingChange}
          isLoading={isPending}
        />
      </RouteFocusModal.Body>
      <RouteFocusModal.Footer>
        <RouteFocusModal.Close render={<Button variant="secondary" size="sm" />}>Cancel</RouteFocusModal.Close>
        <Button type="submit" size="sm" disabled={!isDirty || updatePrices.isPending}>
          Save
        </Button>
      </RouteFocusModal.Footer>
    </KeyboundForm>
  )
}
