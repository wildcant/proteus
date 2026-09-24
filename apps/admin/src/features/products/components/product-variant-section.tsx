import { useLingui } from '@lingui/react/macro'
import { Card } from '@proteus/ui'
import { DataTable } from '#/components/data-table/data-table'
import { useVariantTable } from '#/features/products/hooks/use-variant-table'

export function ProductVariantSection({ productId }: { productId: string }) {
  const { t } = useLingui()
  const variants = useVariantTable(productId)

  return (
    <Card className="p-0">
      <DataTable use={variants} heading={t`Variants`} actions={[{ label: t`Create`, to: 'variants/create' }]} />
    </Card>
  )
}
