import { Trans } from '@lingui/react/macro'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/_shell/')({ component: Home })

function Home() {
  return (
    <div>
      <h1 className="font-semibold text-2xl tracking-tight">
        <Trans>Dashboard</Trans>
      </h1>
      <p className="mt-2 text-muted-foreground text-sm">
        <Trans>Welcome to Proteus Admin.</Trans>
      </p>
    </div>
  )
}
