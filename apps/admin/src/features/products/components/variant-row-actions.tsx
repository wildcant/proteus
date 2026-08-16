import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@proteus/ui'
import { useNavigate } from '@tanstack/react-router'
import { EllipsisIcon } from 'lucide-react'
import type { AdminProductVariant } from '#/api/generated/model'
import { useDeleteProductVariant } from '#/features/products/api/product-variants'

export function VariantRowActions({ productId, variant }: { productId: string; variant: AdminProductVariant }) {
  const navigate = useNavigate()
  const { mutate: deleteVariant } = useDeleteProductVariant(productId, variant.id)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() =>
            navigate({ to: '/products/$id/variants/$variantId', params: { id: productId, variantId: variant.id } })
          }
        >
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => deleteVariant()}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
