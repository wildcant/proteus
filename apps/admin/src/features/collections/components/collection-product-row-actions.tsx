import { Trans } from '@lingui/react/macro'
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@proteus/ui'
import { EllipsisIcon, XIcon } from 'lucide-react'
import type { AdminProduct } from '#/api/generated/model'
import { useSetCollectionProducts } from '#/features/collections/api/collections'

type CollectionProductRowActionsProps = {
  collectionId: string
  product: AdminProduct
}

/** Takes the product out of this Collection. Not confirmed: nothing is deleted, and adding it back is one click. */
export function CollectionProductRowActions({ collectionId, product }: CollectionProductRowActionsProps) {
  const { mutate: setProducts } = useSetCollectionProducts(collectionId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem variant="destructive" onClick={() => setProducts({ remove: [product.id] })}>
          <XIcon />
          <Trans>Remove from collection</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
