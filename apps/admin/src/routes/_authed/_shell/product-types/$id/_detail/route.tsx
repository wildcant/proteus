import { useLingui } from '@lingui/react/macro'
import { Card, CardAction, CardHeader, CardTitle, usePrompt } from '@proteus/ui'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PencilIcon, TrashIcon } from 'lucide-react'
import { ActionMenu } from '#/components/common/action-menu'
import { SingleColumnPageSkeleton } from '#/components/common/skeleton'
import { PageLayout } from '#/components/layout/page-layout'
import {
  productTypeQueryOptions,
  useDeleteProductType,
  useSuspenseProductType,
} from '#/features/product-types/api/product-types'
import { ProductTypeProductsSection } from '#/features/product-types/components/product-type-products-section'
import { useUiCopy } from '#/hooks/use-ui-copy'

export const Route = createFileRoute('/_authed/_shell/product-types/$id/_detail')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(productTypeQueryOptions(params.id)),
  pendingComponent: () => <SingleColumnPageSkeleton sections={2} />,
  component: ProductTypeDetailLayout,
})

function ProductTypeDetailLayout() {
  const { t } = useLingui()
  const { cancel } = useUiCopy()
  const { id } = Route.useParams()
  const { data } = useSuspenseProductType(id)
  const navigate = useNavigate()
  const { mutate: deleteType } = useDeleteProductType(id)
  const prompt = usePrompt()

  const type = data.type

  const handleDelete = async () => {
    const value = type.value
    const confirmed = await prompt({
      title: t`Delete type`,
      description: t`You are about to delete the type ${value}.`,
      confirmText: t`Delete`,
      cancelText: cancel,
      variant: 'danger',
    })
    if (!confirmed) return

    deleteType(undefined, {
      onSuccess: () => navigate({ to: '/product-types' }),
    })
  }

  return (
    <PageLayout.SingleColumn>
      <Card className="gap-0 divide-y py-0">
        <CardHeader>
          <CardTitle>{type.value}</CardTitle>
          <CardAction className="flex items-center gap-x-3">
            <ActionMenu
              groups={[
                { actions: [{ label: t`Edit`, to: './edit', icon: <PencilIcon /> }] },
                { actions: [{ label: t`Delete`, onClick: handleDelete, icon: <TrashIcon /> }] },
              ]}
            />
          </CardAction>
        </CardHeader>
      </Card>
      <ProductTypeProductsSection typeId={id} />
    </PageLayout.SingleColumn>
  )
}
