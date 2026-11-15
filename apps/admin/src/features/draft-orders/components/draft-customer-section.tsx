import { Trans, useLingui } from '@lingui/react/macro'
import { Card, CardAction, CardHeader, CardTitle } from '@proteus/ui'
import { PencilIcon } from 'lucide-react'
import { ActionMenu } from '#/components/common/action-menu'
import { SectionRow } from '#/components/common/section-row'
import type { DraftOrderData } from '#/features/draft-orders/hooks/use-draft-order-data'

/** What the shop confirms in the chat: who the shopper is, how to reach them, where the pairs go. */
export function DraftCustomerSection({ draftOrder, actions }: DraftOrderData) {
  const { t } = useLingui()
  const address = draftOrder.shippingAddress
  const name = [address?.firstName, address?.lastName].filter(Boolean).join(' ')
  const street = [address?.address1, address?.address2].filter(Boolean).join(', ')
  const place = [address?.postalCode, address?.city, address?.province].filter(Boolean).join(' ')

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>
          <Trans>Customer</Trans>
        </CardTitle>
        {!!actions.canEdit && (
          <CardAction>
            <ActionMenu groups={[{ actions: [{ label: t`Edit`, to: './contact', icon: <PencilIcon /> }] }]} />
          </CardAction>
        )}
      </CardHeader>
      <SectionRow title={t`Name`} value={name || null} />
      <SectionRow title={t`Email`} value={draftOrder.email} />
      <SectionRow title={t`Phone`} value={address?.phone ?? null} />
      <SectionRow title={t`Company`} value={address?.company ?? null} />
      <SectionRow title={t`Address`} value={street || null} />
      <SectionRow title={t`City`} value={place || null} />
      <SectionRow title={t`Country`} value={address?.countryCode?.toUpperCase() ?? null} />
    </Card>
  )
}
