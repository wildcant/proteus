import { Trans } from '@lingui/react/macro'
import { ButtonLink } from '@proteus/ui'
import { ShieldXIcon } from 'lucide-react'

export function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <ShieldXIcon className="size-16 text-muted-foreground" />
        <h1 className="font-semibold text-2xl">
          <Trans>Access Denied</Trans>
        </h1>
        <p className="text-muted-foreground">
          <Trans>You don't have permission to access this page.</Trans>
        </p>
        <ButtonLink to="/">
          <Trans>Go to Home</Trans>
        </ButtonLink>
      </div>
    </div>
  )
}
