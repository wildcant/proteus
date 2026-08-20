import { Button } from '@proteus/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { decodeToken } from 'react-jwt'
import { z } from 'zod'
import { CreateAccountForm } from '#/features/users/components/create-account-form'

type InviteTokenPayload = {
  email: string
  purpose: string
}

export const Route = createFileRoute('/_public/invite')({
  component: InvitePage,
  errorComponent: InvalidInviteError,
  validateSearch: z.object({ token: z.string() }),
})

function InvitePage() {
  const { token } = Route.useSearch()
  const [success, setSuccess] = useState(false)

  const decoded = decodeToken<InviteTokenPayload>(token)
  if (decoded?.purpose !== 'invite' || !decoded.email) {
    return <InvalidInviteError />
  }

  if (success) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-6 px-4">
        <div className="flex flex-col items-center gap-1">
          <h1 className="font-semibold text-xl">Your account has been registered</h1>
          <p className="text-muted-foreground text-sm">Get started with the admin right away.</p>
        </div>
        <Link to="/login" className="w-full">
          <Button variant="outline" className="w-full">
            Go to login
          </Button>
        </Link>
        <Link to="/login" className="text-muted-foreground text-sm hover:text-foreground">
          Back to login
        </Link>
      </div>
    )
  }

  return <CreateAccountForm token={token} email={decoded.email} onSuccess={() => setSuccess(true)} />
}

function InvalidInviteError() {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6 px-4">
      <div className="flex flex-col items-center gap-1">
        <h1 className="font-semibold text-xl">Your invite token is invalid</h1>
        <p className="text-muted-foreground text-sm">Try requesting a new invite link.</p>
      </div>
      <Link to="/login" className="text-muted-foreground text-sm hover:text-foreground">
        Back to login
      </Link>
    </div>
  )
}
