import { Badge, Card, CardAction, CardDescription, CardHeader, CardTitle } from '@proteus/ui'
import { useNavigate } from '@tanstack/react-router'
import { PencilIcon, TrashIcon } from 'lucide-react'
import type { AdminProductVariant } from '#/api/generated/model'
import { ActionMenu } from '#/components/common/action-menu'
import { SectionRow } from '#/components/common/section-row'
import { useDeleteProductVariant } from '#/features/products/api/product-variants'

type VariantGeneralSectionProps = {
  productId: string
  variant: AdminProductVariant
}

export function VariantGeneralSection({ productId, variant }: VariantGeneralSectionProps) {
  const navigate = useNavigate()
  const { mutateAsync: deleteVariant } = useDeleteProductVariant(productId, variant.id)

  const handleDelete = async () => {
    await deleteVariant(undefined, {
      onSuccess: () => navigate({ to: '/products/$id', params: { id: productId } }),
    })
  }

  return (
    <Card data-slot="variant-general-section" className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>{variant.title}</CardTitle>
        <CardDescription>Product Variant</CardDescription>
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
      {/* The Option Combination sits with the variant's own identifiers — it is what the variant
       *is*. Already resolved and ordered by the API, so there is nothing to look up here. */}
      {variant.optionValues.map((optionValue) => (
        <SectionRow
          key={optionValue.optionId}
          title={optionValue.optionTitle}
          value={<Badge variant="secondary">{optionValue.value}</Badge>}
        />
      ))}
    </Card>
  )
}
