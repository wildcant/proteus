import { Badge, Card, CardAction, CardDescription, CardHeader, CardTitle } from '@proteus/ui'
import { useNavigate } from '@tanstack/react-router'
import { PencilIcon, TrashIcon } from 'lucide-react'
import type { AdminProductOption, AdminProductVariant } from '#/api/generated/model'
import { ActionMenu } from '#/components/common/action-menu'
import { SectionRow } from '#/components/common/section-row'
import { useDeleteProductVariant } from '#/features/products/api/product-variants'

type VariantGeneralSectionProps = {
  productId: string
  variant: AdminProductVariant
  /** The options the product offers, rank-ordered. Each becomes a row alongside the variant's own fields. */
  options: AdminProductOption[]
}

export function VariantGeneralSection({ productId, variant, options }: VariantGeneralSectionProps) {
  const navigate = useNavigate()
  const { mutateAsync: deleteVariant } = useDeleteProductVariant(productId, variant.id)

  const handleDelete = async () => {
    await deleteVariant(undefined, {
      onSuccess: () => navigate({ to: '/products/$id', params: { id: productId } }),
    })
  }

  const valueById = new Map(options.flatMap((option) => option.values.map((value) => [value.id, value.value])))

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
      {/* The option tuple sits with the variant's own identifiers — it is what the variant *is*. */}
      {options.map((option) => {
        const valueId = variant.optionValues[option.id]
        const value = valueId ? valueById.get(valueId) : undefined
        return (
          <SectionRow
            key={option.id}
            title={option.title}
            value={value ? <Badge variant="secondary">{value}</Badge> : null}
          />
        )
      })}
    </Card>
  )
}
