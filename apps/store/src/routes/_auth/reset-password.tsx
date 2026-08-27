import { toast } from '@proteus/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '#/components/button'
import { AuthHeading } from '#/features/auth/components/auth-heading'
import { ResetPasswordForm } from '#/features/auth/components/reset-password-form'

const searchSchema = z.object({
  token: z.string().min(1),
})

export const Route = createFileRoute('/_auth/reset-password')({
  validateSearch: searchSchema,
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token } = Route.useSearch()
  const [success, setSuccess] = useState(false)

  if (success) {
    return (
      <main className="mt-10 flex w-full max-w-md flex-col items-center">
        <AuthHeading title="Password updated">
          Your password has been reset. Sign in with your new password to pick up where you left off.
        </AuthHeading>
        <Button render={<Link to="/login" />} className="mt-10 h-14 w-full font-semibold text-base">
          Sign in
        </Button>
      </main>
    )
  }

  return (
    <main className="mt-10 flex w-full max-w-md flex-col items-center">
      <AuthHeading title="Set a new password">Choose a new password for your account.</AuthHeading>
      <div className="mt-10 w-full">
        <ResetPasswordForm
          token={token}
          onSuccess={() => setSuccess(true)}
          onError={(error) => toast.add({ type: 'error', title: error })}
        />
      </div>
      <Button variant="link" render={<Link to="/login" />} className="mt-6 text-sm">
        Back to sign in
      </Button>
    </main>
  )
}
