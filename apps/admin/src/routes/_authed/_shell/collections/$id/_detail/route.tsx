import { useLingui } from '@lingui/react/macro'
import { Card, CardAction, CardHeader, CardTitle, usePrompt } from '@proteus/ui'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PencilIcon, TrashIcon } from 'lucide-react'
import { ActionMenu } from '#/components/common/action-menu'
import { SectionRow } from '#/components/common/section-row'
import { SingleColumnPageSkeleton } from '#/components/common/skeleton'
import { PageLayout } from '#/components/layout/page-layout'
import {
  collectionQueryOptions,
  useDeleteCollection,
  useSetCollectionProducts,
  useSuspenseCollection,
} from '#/features/collections/api/collections'
import { ProductGroupSection } from '#/features/products/components/product-group-section'
import { formatGroupingRule } from '#/features/products/utils/grouping-rule'
import { useUiCopy } from '#/hooks/use-ui-copy'

export const Route = createFileRoute('/_authed/_shell/collections/$id/_detail')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(collectionQueryOptions(params.id)),
  pendingComponent: () => <SingleColumnPageSkeleton sections={2} />,
  component: CollectionDetailLayout,
})

function CollectionDetailLayout() {
  const { t } = useLingui()
  const { cancel } = useUiCopy()
  const { id } = Route.useParams()
  const { data } = useSuspenseCollection(id)
  const navigate = useNavigate()
  const { mutate: deleteCollection } = useDeleteCollection(id)
  const { mutate: setProducts } = useSetCollectionProducts(id)
  const prompt = usePrompt()

  const collection = data.collection

  const handleDelete = async () => {
    const title = collection.title
    const confirmed = await prompt({
      title: t`Delete collection`,
      description: t`You are about to delete the collection ${title}.`,
      confirmText: t`Delete`,
      cancelText: cancel,
      variant: 'danger',
    })
    if (!confirmed) return

    deleteCollection(undefined, {
      onSuccess: () => navigate({ to: '/collections' }),
    })
  }

  return (
    <PageLayout.SingleColumn>
      <Card className="gap-0 divide-y py-0">
        <CardHeader>
          <CardTitle>{collection.title}</CardTitle>
          <CardAction className="flex items-center gap-x-3">
            <ActionMenu
              groups={[
                { actions: [{ label: t`Edit`, to: './edit', icon: <PencilIcon /> }] },
                { actions: [{ label: t`Delete`, onClick: handleDelete, icon: <TrashIcon /> }] },
              ]}
            />
          </CardAction>
        </CardHeader>
        <SectionRow title={t`Handle`} value={collection.handle} />
        <SectionRow
          title={t`Thumbnail`}
          value={
            collection.thumbnail ? (
              <img src={collection.thumbnail} alt="" className="size-16 rounded-md border object-cover" />
            ) : (
              '-'
            )
          }
        />
        {!!collection.rule && (
          <SectionRow
            title={t`Rule`}
            description={t`Products whose metafields match are listed here.`}
            value={formatGroupingRule(collection.rule)}
          />
        )}
      </Card>
      {/* A rule alone decides a ruled Collection's products, so its list is read-only. */}
      <ProductGroupSection
        filter={{ collectionId: id }}
        emptyDescription={
          collection.rule
            ? t`No product matches this collection's rule yet.`
            : t`Add products to list them in this collection.`
        }
        membership={
          collection.rule
            ? undefined
            : {
                editTo: `/collections/${id}/products`,
                removeLabel: t`Remove from collection`,
                onRemove: (productId) => setProducts({ remove: [productId] }),
              }
        }
      />
    </PageLayout.SingleColumn>
  )
}
