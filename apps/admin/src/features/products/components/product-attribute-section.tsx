import { Card, CardAction, CardHeader, CardTitle } from '@proteus/ui'
import { PencilIcon } from 'lucide-react'
import type { AdminProduct } from '#/api/generated/model'
import { ActionMenu } from '#/components/common/action-menu'
import { SectionRow } from '#/components/common/section-row'

export function ProductAttributeSection({ product }: { product: AdminProduct }) {
  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>Attributes</CardTitle>
        <CardAction>
          <ActionMenu
            groups={[
              {
                actions: [{ label: 'Edit', to: './attributes', icon: <PencilIcon /> }],
              },
            ]}
          />
        </CardAction>
      </CardHeader>
      <SectionRow title="Height" value={product.height?.toString()} />
      <SectionRow title="Width" value={product.width?.toString()} />
      <SectionRow title="Length" value={product.length?.toString()} />
      <SectionRow title="Weight" value={product.weight?.toString()} />
      <SectionRow title="MID Code" value={product.midCode} />
      <SectionRow title="HS Code" value={product.hsCode} />
      <SectionRow title="Country of Origin" value={product.originCountry} />
    </Card>
  )
}
