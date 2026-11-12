import { useLingui } from '@lingui/react/macro'
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@proteus/ui'
import { EllipsisIcon, XIcon } from 'lucide-react'
import { DataTable } from '#/components/data-table/data-table'
import { type ProductListFilter, useProductListTable } from '#/features/products/hooks/use-product-list-table'

/** How a hand-picked group — a Category, a Collection — edits its members from this section. */
type ProductGroupMembership = {
  /** The product picker's route. */
  editTo: string
  removeLabel: string
  /** Takes one product out. Not confirmed: nothing is deleted, and adding it back is one click. */
  onRemove: (productId: string) => void
}

type ProductGroupSectionProps = {
  filter: ProductListFilter
  emptyDescription: string
  /** Absent where membership is set from the product — a Type, a Tag — so the list is read-only. */
  membership?: ProductGroupMembership
}

/** A grouping's products, on its detail page. For a Category, only its direct members. */
export function ProductGroupSection({ filter, emptyDescription, membership }: ProductGroupSectionProps) {
  const { t } = useLingui()
  const products = useProductListTable(filter, {
    // The only product list on a grouping's page; the picker opened over it holds `picker`.
    prefix: 'products',
    rowHref: (row) => `/products/${row.id}`,
    rowActions: membership
      ? (row) => <RemoveFromGroupMenu label={membership.removeLabel} onRemove={() => membership.onRemove(row.id)} />
      : undefined,
    empty: { heading: t`No products`, description: emptyDescription },
  })

  return (
    <DataTable
      use={products}
      heading={t`Products`}
      actions={membership ? [{ label: t`Edit products`, to: membership.editTo }] : undefined}
    />
  )
}

function RemoveFromGroupMenu({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { t } = useLingui()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label={t`Actions`} />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem variant="destructive" onClick={onRemove}>
          <XIcon />
          {label}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
