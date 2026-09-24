import { Trans, useLingui } from '@lingui/react/macro'
import { Badge, Card, CardAction, CardHeader, CardTitle } from '@proteus/ui'
import { ArrowRightIcon, ListFilterIcon } from 'lucide-react'
import { ActionMenu } from '#/components/common/action-menu'
import { useProductOptionsForProduct } from '#/features/product-options/api/product-options'

export function ProductOptionSection({ productId }: { productId: string }) {
  const { t } = useLingui()
  const { data } = useProductOptionsForProduct(productId)
  const options = data?.productOptions ?? []

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>
          <Trans>Options</Trans>
        </CardTitle>
        <CardAction>
          <ActionMenu groups={[{ actions: [{ label: t`Manage`, to: './options', icon: <ListFilterIcon /> }] }]} />
        </CardAction>
      </CardHeader>
      {options.length === 0 ? (
        <div className="px-6 py-4 text-muted-foreground text-sm">
          <Trans>No options linked to this product.</Trans>
        </div>
      ) : (
        options.map((option) => (
          <div key={option.id} className="grid grid-cols-[1fr_1fr_28px] items-center gap-4 px-6 py-4 text-sm">
            <span className="font-medium text-muted-foreground">{option.title}</span>
            <div className="flex flex-wrap gap-1">
              {option.values.map((value) => (
                <Badge key={value.id} variant="outline">
                  {value.value}
                </Badge>
              ))}
            </div>
            <ActionMenu
              groups={[
                {
                  actions: [
                    { label: t`Go to product option`, to: `/product-options/${option.id}`, icon: <ArrowRightIcon /> },
                  ],
                },
              ]}
            />
          </div>
        ))
      )}
    </Card>
  )
}
