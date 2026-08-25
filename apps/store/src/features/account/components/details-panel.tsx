import { AccountPanel } from '#/features/account/components/account-panel'

type DetailsPanelProps = {
  /** Both halves are nullable on the customer record — a guest checkout never asks for them. */
  firstName: string | null
  lastName: string | null
  email: string
}

/**
 * Read-only on purpose: `GET /store/customers/me` is the only method on that route, so an edit
 * affordance here would have nothing to post to.
 */
export function DetailsPanel({ firstName, lastName, email }: DetailsPanelProps) {
  const name = [firstName, lastName].filter(Boolean).join(' ')

  return (
    <AccountPanel title="Details">
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {name ? (
          <>
            <dt className="text-ink-muted">Name</dt>
            <dd className="text-ink">{name}</dd>
          </>
        ) : null}
        <dt className="text-ink-muted">Email</dt>
        <dd className="truncate text-ink">{email}</dd>
      </dl>
    </AccountPanel>
  )
}
