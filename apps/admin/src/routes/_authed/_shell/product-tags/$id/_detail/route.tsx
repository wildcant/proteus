import { useLingui } from '@lingui/react/macro'
import { Card, CardAction, CardHeader, CardTitle, usePrompt } from '@proteus/ui'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PencilIcon, TrashIcon } from 'lucide-react'
import { ActionMenu } from '#/components/common/action-menu'
import { SingleColumnPageSkeleton } from '#/components/common/skeleton'
import { PageLayout } from '#/components/layout/page-layout'
import {
  productTagQueryOptions,
  useDeleteProductTag,
  useSuspenseProductTag,
} from '#/features/product-tags/api/product-tags'
import { ProductTagProductsSection } from '#/features/product-tags/components/product-tag-products-section'
import { useUiCopy } from '#/hooks/use-ui-copy'

export const Route = createFileRoute('/_authed/_shell/product-tags/$id/_detail')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(productTagQueryOptions(params.id)),
  pendingComponent: () => <SingleColumnPageSkeleton sections={2} />,
  component: ProductTagDetailLayout,
})

function ProductTagDetailLayout() {
  const { t } = useLingui()
  const { cancel } = useUiCopy()
  const { id } = Route.useParams()
  const { data } = useSuspenseProductTag(id)
  const navigate = useNavigate()
  const { mutate: deleteTag } = useDeleteProductTag(id)
  const prompt = usePrompt()

  const tag = data.tag

  const handleDelete = async () => {
    const value = tag.value
    const confirmed = await prompt({
      title: t`Delete tag`,
      description: t`You are about to delete the tag ${value}.`,
      confirmText: t`Delete`,
      cancelText: cancel,
      variant: 'danger',
    })
    if (!confirmed) return

    deleteTag(undefined, {
      onSuccess: () => navigate({ to: '/product-tags' }),
    })
  }

  return (
    <PageLayout.SingleColumn>
      <Card className="gap-0 divide-y py-0">
        <CardHeader>
          <CardTitle>{tag.value}</CardTitle>
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
      <ProductTagProductsSection tagId={id} />
    </PageLayout.SingleColumn>
  )
}
