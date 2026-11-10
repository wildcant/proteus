import { Trans } from '@lingui/react/macro'
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@proteus/ui'
import { EllipsisIcon, XIcon } from 'lucide-react'
import type { AdminProduct } from '#/api/generated/model'
import { useSetCategoryProducts } from '#/features/categories/api/categories'

type CategoryProductRowActionsProps = {
  categoryId: string
  product: AdminProduct
}

/** Takes the product out of this Category. Not confirmed: nothing is deleted, and adding it back is one click. */
export function CategoryProductRowActions({ categoryId, product }: CategoryProductRowActionsProps) {
  const { mutate: setProducts } = useSetCategoryProducts(categoryId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem variant="destructive" onClick={() => setProducts({ remove: [product.id] })}>
          <XIcon />
          <Trans>Remove from category</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
