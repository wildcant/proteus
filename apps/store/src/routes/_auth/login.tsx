import { toast } from '@proteus/ui'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { Button } from '#/components/button'
import { AuthHeading } from '#/features/auth/components/auth-heading'
import { LoginForm } from '#/features/auth/components/login-form'
import { VerifyPending } from '#/features/auth/components/verify-pending'
import { useAuthSuccess } from '#/features/auth/hooks/use-auth-success'
import { isRegistered } from '#/lib/auth-token'

const loginSearchSchema = z.object({
  // Where to return to once signed in — without it, a shopper who taps Sign in mid-checkout lands
  // on /account with the checkout gone. Same-site paths only, or the sign-in page is an open
  // redirect; `.catch` rather than a throw, since a hand-edited `?redirect=` is not an error page.
  redirect: z
    .string()
    .refine((value) => value.startsWith('/') && !value.startsWith('//'), 'Must be a path on this site')
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute('/_auth/login')({
  validateSearch: loginSearchSchema,
  beforeLoad: ({ search }) => {
    if (!isRegistered()) return
    throw redirect({ to: search.redirect ?? '/account' })
  },
  component: LoginPage,
})

function LoginPage() {
  const { redirect: redirectTo } = Route.useSearch()
  const { isVerifyPending, handleSuccess } = useAuthSuccess({ redirectTo })

  return (
    <main className="mt-10 flex w-full max-w-md flex-col items-center">
      {isVerifyPending ? (
        <VerifyPending />
      ) : (
        <>
          <AuthHeading title="Sign in">Track your orders, save your details, and check out faster.</AuthHeading>
          <div className="mt-10 w-full">
            <LoginForm onSuccess={handleSuccess} onError={(error) => toast.add({ type: 'error', title: error })} />
          </div>
          <p className="mt-6 text-center text-ink-muted text-sm">
            Don't have an account?{' '}
            <Button variant="link" render={<Link to="/signup" />} className="align-baseline text-sm">
              Sign up
            </Button>
          </p>
        </>
      )}
    </main>
  )
}
