import { Button } from '@proteus/ui'
import { useCallback, useMemo, useState } from 'react'
import type { AdminProductVariant, AdminUpdateVariantPricesPricesItem } from '#/api/generated/model'
import { DataGrid } from '#/components/data-grid'
import type { DataGridColumn } from '#/components/data-grid/types'
import { KeyboundForm } from '#/components/modals/keybound-form'
import { RouteFocusModal } from '#/components/modals/route-focus-modal/route-focus-modal'
import { useRouteModal } from '#/components/modals/route-modal-provider/use-route-modal'
import { useUpdateVariantPrices } from '#/features/products/api/product-variants'

type PriceRow = {
  id: string | undefined
  currencyCode: string
  amount: string
}

const columns: DataGridColumn<PriceRow>[] = [
  { accessorKey: 'amount', header: 'Price USD', type: 'currency', currencyCode: 'usd' },
]

function buildPricePayload(initial: PriceRow[], current: PriceRow[]): AdminUpdateVariantPricesPricesItem[] | undefined {
  const prices: AdminUpdateVariantPricesPricesItem[] = []
  let hasChanges = false

  for (const row of current) {
    const originalRow = initial.find((initialRow) => initialRow.currencyCode === row.currencyCode)
    if (!originalRow || originalRow.amount !== row.amount) {
      hasChanges = true
    }
    prices.push({
      ...(row.id ? { id: row.id } : {}),
      amount: row.amount,
    })
  }

  return hasChanges ? prices : undefined
}

export function VariantPriceEditForm({ productId, variant }: { productId: string; variant: AdminProductVariant }) {
  const { handleSuccess, setCloseOnEscape } = useRouteModal()
  const updatePrices = useUpdateVariantPrices(productId, variant.id)

  const initialRows = useMemo((): PriceRow[] => {
    const prices = variant.prices ?? []
    const usdPrice = prices.find((price) => price.currencyCode === 'usd')
    return [
      {
        id: usdPrice?.id,
        currencyCode: 'usd',
        amount: usdPrice?.amount ?? '0',
      },
    ]
  }, [variant.prices])

  const [rows, setRows] = useState<PriceRow[]>(initialRows)

  const isDirty = useMemo(() => {
    return rows.some((row, index) => {
      const initial = initialRows[index]
      return initial?.amount !== row.amount
    })
  }, [rows, initialRows])

  const handleEditingChange = useCallback(
    (isEditing: boolean) => {
      setCloseOnEscape(!isEditing)
    },
    [setCloseOnEscape],
  )

  const handleSubmit = (event: React.SubmitEvent) => {
    event.preventDefault()
    const payload = buildPricePayload(initialRows, rows)
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
        <DataGrid data={rows} columns={columns} onChange={setRows} onEditingChange={handleEditingChange} />
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
