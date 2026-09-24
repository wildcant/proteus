import { Trans, useLingui } from '@lingui/react/macro'
import { Card, CardAction, CardHeader, CardTitle } from '@proteus/ui'
import { PencilIcon } from 'lucide-react'
import type { AdminProduct } from '#/api/generated/model'
import { ActionMenu } from '#/components/common/action-menu'
import { SectionRow } from '#/components/common/section-row'

export function ProductAttributeSection({ product }: { product: AdminProduct }) {
  const { t } = useLingui()

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>
          <Trans>Attributes</Trans>
        </CardTitle>
        <CardAction>
          <ActionMenu
            groups={[
              {
                actions: [{ label: t`Edit`, to: './attributes', icon: <PencilIcon /> }],
              },
            ]}
          />
        </CardAction>
      </CardHeader>
      <SectionRow title={t`Height`} value={product.height?.toString()} />
      <SectionRow title={t`Width`} value={product.width?.toString()} />
      <SectionRow title={t`Length`} value={product.length?.toString()} />
      <SectionRow title={t`Weight`} value={product.weight?.toString()} />
      <SectionRow title={t`MID Code`} value={product.midCode} />
      <SectionRow title={t`HS Code`} value={product.hsCode} />
      <SectionRow title={t`Country of Origin`} value={product.originCountry} />
    </Card>
  )
}
