import { Badge, Card, CardAction, CardHeader, CardTitle, usePrompt } from '@proteus/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PencilIcon, TrashIcon } from 'lucide-react'
import { ActionMenu } from '#/components/common/action-menu'
import { SectionRow } from '#/components/common/section-row'
import { SingleColumnPageSkeleton } from '#/components/common/skeleton'
import { DataTable } from '#/components/data-table'
import { PageLayout } from '#/components/layout/page-layout'
import { productOptionQueryOptions, useDeleteProductOption } from '#/features/product-options/api/product-options'
import { useOptionProductsTable } from '#/features/product-options/hooks/use-option-products-table'
import { useOptionValuesTable } from '#/features/product-options/hooks/use-option-values-table'

export const Route = createFileRoute('/_authed/_shell/product-options/$id/_detail')({
  pendingComponent: () => <SingleColumnPageSkeleton sections={2} />,
  component: ProductOptionDetailLayout,
})

function ProductOptionDetailLayout() {
  const { id } = Route.useParams()
  const { data } = useSuspenseQuery(productOptionQueryOptions(id))
  const navigate = useNavigate()
  const { mutateAsync: deleteOption } = useDeleteProductOption(id)
  const prompt = usePrompt()

  const valuesTable = useOptionValuesTable(data.productOption)
  const productsTable = useOptionProductsTable(id)

  const handleDelete = async () => {
    const confirmed = await prompt({
      title: 'Delete option',
      description: `Are you sure you want to delete "${data.productOption.title}"? This will remove it from all products.`,
      confirmText: 'Delete',
      variant: 'danger',
    })

    if (confirmed) {
      await deleteOption(undefined, {
        onSuccess: () => navigate({ to: '/product-options' }),
      })
    }
  }

  return (
    <PageLayout.SingleColumn>
      <Card className="gap-0 divide-y py-0">
        <CardHeader>
          <CardTitle>{data.productOption.title}</CardTitle>
          <CardAction className="flex items-center gap-x-3">
            <ActionMenu
              groups={[
                { actions: [{ label: 'Edit', to: './edit', icon: <PencilIcon /> }] },
                { actions: [{ label: 'Delete', onClick: handleDelete, icon: <TrashIcon /> }] },
              ]}
            />
          </CardAction>
        </CardHeader>
        <SectionRow title="Type" value={<Badge>Global</Badge>} />
      </Card>
      <Card className="p-0">
        <DataTable use={valuesTable} heading="Values" />
      </Card>
      <Card className="p-0">
        <DataTable use={productsTable} heading="Products" />
      </Card>
    </PageLayout.SingleColumn>
  )
}
