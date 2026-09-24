import { useLingui } from '@lingui/react/macro'
import { Card, CardAction, CardHeader, CardTitle, StatusBadge, usePrompt } from '@proteus/ui'
import { useNavigate } from '@tanstack/react-router'
import { PencilIcon, TrashIcon } from 'lucide-react'
import type { AdminProduct } from '#/api/generated/model'
import { ActionMenu } from '#/components/common/action-menu'
import { SectionRow } from '#/components/common/section-row'
import { useDeleteProduct } from '#/features/products/api/products'
import { productStatusColors, productStatusLabels } from '#/features/products/utils/product-status'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function ProductGeneralSection({ product }: { product: AdminProduct }) {
  const { t, i18n } = useLingui()
  const { cancel } = useUiCopy()
  const navigate = useNavigate()
  const { mutateAsync: deleteProduct } = useDeleteProduct(product.id)
  const prompt = usePrompt()

  const handleDelete = async () => {
    const title = product.title
    const confirmed = await prompt({
      title: t`Delete product`,
      description: t`Are you sure you want to delete "${title}"?`,
      confirmText: t`Delete`,
      cancelText: cancel,
      variant: 'danger',
    })

    if (confirmed) {
      await deleteProduct(undefined, { onSuccess: () => navigate({ to: '/products' }) })
    }
  }

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>{product.title}</CardTitle>
        <CardAction className="flex items-center gap-x-3">
          <StatusBadge color={productStatusColors[product.status]}>
            {i18n._(productStatusLabels[product.status])}
          </StatusBadge>
          <ActionMenu
            groups={[
              { actions: [{ label: t`Edit`, to: './edit', icon: <PencilIcon /> }] },
              { actions: [{ label: t`Delete`, onClick: handleDelete, icon: <TrashIcon /> }] },
            ]}
          />
        </CardAction>
      </CardHeader>
      <SectionRow title={t`Description`} value={product.description} />
      <SectionRow title={t`Subtitle`} value={product.subtitle} />
      <SectionRow title={t`Handle`} value={product.handle ? `/${product.handle}` : null} />
      <SectionRow title={t`Material`} value={product.material} />
      <SectionRow title={t`Discountable`} value={product.discountable ? t`True` : t`False`} />
    </Card>
  )
}
