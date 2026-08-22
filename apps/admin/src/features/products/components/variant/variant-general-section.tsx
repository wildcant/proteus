import { Card, CardAction, CardHeader, CardTitle } from '@proteus/ui'
import { useNavigate } from '@tanstack/react-router'
import { PencilIcon, TrashIcon } from 'lucide-react'
import type { AdminProductVariant } from '#/api/generated/model'
import { ActionMenu } from '#/components/common/action-menu'
import { SectionRow } from '#/components/common/section-row'
import { useDeleteProductVariant } from '#/features/products/api/product-variants'

export function VariantGeneralSection({ productId, variant }: { productId: string; variant: AdminProductVariant }) {
  const navigate = useNavigate()
  const { mutateAsync: deleteVariant } = useDeleteProductVariant(productId, variant.id)

  const handleDelete = async () => {
    await deleteVariant(undefined, {
      onSuccess: () => navigate({ to: '/products/$id', params: { id: productId } }),
    })
  }

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>{variant.title}</CardTitle>
        <CardAction>
          <ActionMenu
            groups={[
              { actions: [{ label: 'Edit', to: './edit', icon: <PencilIcon /> }] },
              { actions: [{ label: 'Delete', onClick: handleDelete, icon: <TrashIcon /> }] },
            ]}
          />
        </CardAction>
      </CardHeader>
      <SectionRow title="SKU" value={variant.sku} />
      <SectionRow title="Barcode" value={variant.barcode} />
      <SectionRow title="EAN" value={variant.ean} />
      <SectionRow title="UPC" value={variant.upc} />
      <SectionRow title="HS Code" value={variant.hsCode} />
      <SectionRow title="Origin Country" value={variant.originCountry} />
      <SectionRow title="Material" value={variant.material} />
    </Card>
  )
}
