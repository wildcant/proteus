import { toast } from '@proteus/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
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
    <main className="demo-center px-4">
      <div className="demo-panel max-w-sm w-full flex flex-col items-center">
        {!success ? (
          <>
            <h1 className="demo-section-title uppercase mb-2">Set new password</h1>
            <p className="mb-6 text-center text-sm text-[var(--sea-ink-soft)]">Enter your new password below.</p>
            <ResetPasswordForm
              token={token}
              onSuccess={() => setSuccess(true)}
              onError={(error) => toast.add({ type: 'error', title: error })}
            />
          </>
        ) : (
          <>
            <h1 className="demo-section-title uppercase mb-2">Password updated</h1>
            <p className="text-center text-sm text-[var(--sea-ink-soft)]">
              Your password has been reset successfully. You can now sign in with your new password.
            </p>
            <Link to="/login" className="demo-button mt-6">
              Sign in
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
