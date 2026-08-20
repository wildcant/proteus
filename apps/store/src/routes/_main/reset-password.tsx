import { toast } from '@proteus/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { Button } from '#/components/button'
import { ResetPasswordForm } from '#/features/auth/components/reset-password-form'

const searchSchema = z.object({
  token: z.string().min(1),
})

export const Route = createFileRoute('/_main/reset-password')({
  validateSearch: searchSchema,
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token } = Route.useSearch()
  const [success, setSuccess] = useState(false)

  return (
    <main className="flex min-h-[calc(100vh-13rem)] items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col items-center rounded-lg border border-border p-8">
        {!success ? (
          <>
            <h1 className="mb-2 text-sm font-bold uppercase tracking-widest text-foreground">Set new password</h1>
            <p className="mb-6 text-center text-sm text-(--foreground-muted)">Enter your new password below.</p>
            <ResetPasswordForm
              token={token}
              onSuccess={() => setSuccess(true)}
              onError={(error) => toast.add({ type: 'error', title: error })}
            />
          </>
        ) : (
          <>
            <h1 className="mb-2 text-sm font-bold uppercase tracking-widest text-foreground">Password updated</h1>
            <p className="text-center text-sm text-(--foreground-muted)">
              Your password has been reset successfully. You can now sign in with your new password.
            </p>
            <Button variant="outline" render={<Link to="/login" />} className="mt-6">
              Sign in
            </Button>
          </>
        )}
      </div>
    </main>
  )
}
