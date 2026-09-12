import { Card } from '@proteus/ui'
import { DataTable } from '#/components/data-table/data-table'
import { useVariantTable } from '#/features/products/hooks/use-variant-table'

export function ProductVariantSection({ productId }: { productId: string }) {
  const variants = useVariantTable(productId)

  return (
    <Card className="p-0">
      <DataTable use={variants} heading="Variants" actions={[{ label: 'Create', to: 'variants/create' }]} />
    </Card>
  )
}
