import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteFocusModal, useRouteModal } from '@proteus/ui'
import { useCallback, useMemo, useState } from 'react'
import type { AdminProductVariant } from '#/api/generated/model'
import { DataGrid } from '#/components/data-grid/data-grid'
import { useUpdateVariantPrices } from '#/features/products/api/product-variants'
import {
  buildPriceColumns,
  buildPricePayload,
  type CurrencyAmounts,
  compareAtKey,
} from '#/features/products/utils/price-columns'
import { useStoreCurrencies } from '#/features/store/api/store'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function VariantPriceEditForm({ productId, variant }: { productId: string; variant: AdminProductVariant }) {
  const { i18n } = useLingui()
  const { closeLabel } = useUiCopy()
  const { handleSuccess, setCloseOnEscape } = useRouteModal()
  const updatePrices = useUpdateVariantPrices(productId, variant.id)
  const { currencyCodes, isPending } = useStoreCurrencies()

  const columns = useMemo(() => buildPriceColumns(currencyCodes, i18n), [currencyCodes, i18n])

  const priceIdByCurrency = useMemo(
    () => new Map((variant.prices ?? []).map((price) => [price.currencyCode, price.id])),
    [variant.prices],
  )

  const initialRow = useMemo((): CurrencyAmounts => {
    const priceByCurrency = new Map((variant.prices ?? []).map((price) => [price.currencyCode, price]))
    return Object.fromEntries(
      currencyCodes.flatMap((code) => {
        const price = priceByCurrency.get(code)
        return [
          [code, price?.amount ?? ''],
          [compareAtKey(code), price?.compareAtAmount ?? ''],
        ]
      }),
    )
  }, [variant.prices, currencyCodes])

  // Null until the merchant types, so the row still picks up the store currencies when they land
  // after the first render. Seeding state from a list that is still loading would leave the grid
  // permanently one currency short.
  const [draftRow, setDraftRow] = useState<CurrencyAmounts | null>(null)
  const row = draftRow ?? initialRow

  const handleEditingChange = useCallback(
    (isEditing: boolean) => {
      setCloseOnEscape(!isEditing)
    },
    [setCloseOnEscape],
  )

  const handleSubmit = (event: React.SubmitEvent) => {
    event.preventDefault()
    const payload = buildPricePayload(currencyCodes, initialRow, row, priceIdByCurrency)
    if (!payload) {
      handleSuccess()
      return
    }

    updatePrices.mutate({ prices: payload }, { onSuccess: () => handleSuccess() })
  }

  return (
    <KeyboundForm onSubmit={handleSubmit} className="flex flex-1 flex-col">
      <RouteFocusModal.Header closeLabel={closeLabel} />
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
        <RouteFocusModal.Close render={<Button variant="secondary" size="sm" />}>
          <Trans>Cancel</Trans>
        </RouteFocusModal.Close>
        {/* No `useAppForm` behind this one — the grid is `useState`, so there is no form context
            for `form.SubmitButton` to read. Exempted in the rule; see submit-button-not-from-form-hook. */}
        <Button type="submit" size="sm" disabled={updatePrices.isPending}>
          <Trans>Save</Trans>
        </Button>
      </RouteFocusModal.Footer>
    </KeyboundForm>
  )
}
