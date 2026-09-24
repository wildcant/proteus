import { Trans, useLingui } from '@lingui/react/macro'
import { Badge, Card, CardAction, CardHeader, CardTitle, usePrompt } from '@proteus/ui'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PencilIcon, TrashIcon } from 'lucide-react'
import { ActionMenu } from '#/components/common/action-menu'
import { SectionRow } from '#/components/common/section-row'
import { SingleColumnPageSkeleton } from '#/components/common/skeleton'
import { DataTable } from '#/components/data-table/data-table'
import { PageLayout } from '#/components/layout/page-layout'
import { useDeleteProductOption, useSuspenseProductOption } from '#/features/product-options/api/product-options'
import { useOptionProductsTable } from '#/features/product-options/hooks/use-option-products-table'
import { useOptionValuesTable } from '#/features/product-options/hooks/use-option-values-table'
import { useUiCopy } from '#/hooks/use-ui-copy'

export const Route = createFileRoute('/_authed/_shell/product-options/$id/_detail')({
  pendingComponent: () => <SingleColumnPageSkeleton sections={2} />,
  component: ProductOptionDetailLayout,
})

function ProductOptionDetailLayout() {
  const { t } = useLingui()
  const { cancel } = useUiCopy()
  const { id } = Route.useParams()
  const { data } = useSuspenseProductOption(id)
  const navigate = useNavigate()
  const { mutateAsync: deleteOption } = useDeleteProductOption(id)
  const prompt = usePrompt()

  const valuesTable = useOptionValuesTable(data.productOption)
  const productsTable = useOptionProductsTable(id)

  const handleDelete = async () => {
    const title = data.productOption.title
    const confirmed = await prompt({
      title: t`Delete option`,
      description: t`Are you sure you want to delete "${title}"? This will remove it from all products.`,
      confirmText: t`Delete`,
      cancelText: cancel,
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
                { actions: [{ label: t`Edit`, to: './edit', icon: <PencilIcon /> }] },
                { actions: [{ label: t`Delete`, onClick: handleDelete, icon: <TrashIcon /> }] },
              ]}
            />
          </CardAction>
        </CardHeader>
        <SectionRow
          title={t`Type`}
          value={
            <Badge>
              <Trans>Global</Trans>
            </Badge>
          }
        />
      </Card>
      <Card className="p-0">
        <DataTable use={valuesTable} heading={t`Values`} />
      </Card>
      <Card className="p-0">
        <DataTable use={productsTable} heading={t`Products`} />
      </Card>
    </PageLayout.SingleColumn>
  )
}
