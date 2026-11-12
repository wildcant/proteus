import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Panel } from '#/components/store/panel/panel'
import {
  detailsPanel,
  detailsPanelEmail,
  detailsPanelList,
  detailsPanelName,
  detailsPanelPanel,
  detailsPanelTerm,
} from '#/features/account/components/details-panel/details-panel.variants'

type DetailsPanelProps = {
  /** Both halves are nullable on the customer record — a guest checkout never asks for them. */
  firstName: string | null
  lastName: string | null
  email: string
  className?: string
}

/**
 * Read-only on purpose: `GET /store/customers/me` is the only method on that route, so an edit
 * affordance here would have nothing to post to.
 *
 * The set's root and its Panel instance are one element here: the panel is the whole component.
 */
export function DetailsPanel({ firstName, lastName, email, className }: DetailsPanelProps) {
  const { t } = useLingui()
  const name = [firstName, lastName].filter(Boolean).join(' ')

  return (
    <Panel title={t`Details`} className={cn(detailsPanel(), detailsPanelPanel(), className)}>
      <dl className={detailsPanelList()}>
        {name ? (
          <>
            <dt className={detailsPanelTerm()}>
              <Trans>Name</Trans>
            </dt>
            <dd className={detailsPanelName()}>{name}</dd>
          </>
        ) : null}
        <dt className={detailsPanelTerm()}>
          <Trans>Email</Trans>
        </dt>
        <dd className={cn(detailsPanelEmail(), 'truncate')}>{email}</dd>
      </dl>
    </Panel>
  )
}
