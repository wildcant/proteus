import { Badge, Card, CardAction, CardHeader, CardTitle, toast } from '@proteus/ui'
import { useNavigate } from '@tanstack/react-router'
import { PencilIcon, TrashIcon } from 'lucide-react'
import type { AdminProduct } from '#/api/generated/model'
import { ActionMenu } from '#/components/common/action-menu'
import { SectionRow } from '#/components/common/section-row'
import { useDeleteProduct } from '#/features/products/api/products'
import { productStatusBadgeVariants } from '#/features/products/constants'
import { usePrompt } from '#/hooks/use-prompt.tsx'

export function ProductGeneralSection({ product }: { product: AdminProduct }) {
  const navigate = useNavigate()
  const { mutateAsync: deleteProduct } = useDeleteProduct(product.id)
  const prompt = usePrompt()

  const handleDelete = async () => {
    const confirmed = await prompt({
      title: 'Delete product',
      description: `Are you sure you want to delete "${product.title}"?`,
      confirmText: 'Delete',
      variant: 'danger',
    })

    if (confirmed) {
      await deleteProduct(undefined, {
        onSuccess: () => navigate({ to: '/products' }),
        onError: (error) => toast.add({ type: 'error', title: 'Failed to delete product', description: error.message }),
      })
    }
  }

  return (
    <Card className="divide-y gap-0 py-0">
      <CardHeader>
        <CardTitle>{product.title}</CardTitle>
        <CardAction className="flex items-center gap-x-3">
          <Badge variant={productStatusBadgeVariants[product.status] ?? 'secondary'}>{product.status}</Badge>
          <ActionMenu
            groups={[
              { actions: [{ label: 'Edit', to: './edit', icon: <PencilIcon /> }] },
              { actions: [{ label: 'Delete', onClick: handleDelete, icon: <TrashIcon /> }] },
            ]}
          />
        </CardAction>
      </CardHeader>
      <SectionRow title="Description" value={product.description} />
      <SectionRow title="Subtitle" value={product.subtitle} />
      <SectionRow title="Handle" value={product.handle ? `/${product.handle}` : null} />
      <SectionRow title="Material" value={product.material} />
      <SectionRow title="Discountable" value={product.discountable ? 'True' : 'False'} />
    </Card>
  )
}
