import { toast } from '@proteus/ui'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Button } from '#/components/button'
import { AuthHeading } from '#/features/auth/components/auth-heading'
import { LoginForm } from '#/features/auth/components/login-form'
import { VerifyPending } from '#/features/auth/components/verify-pending'
import { useAuthSuccess } from '#/features/auth/hooks/use-auth-success'
import { isRegistered } from '#/lib/auth-token'

export const Route = createFileRoute('/_auth/login')({
  beforeLoad: () => {
    // isRegistered, not getToken: signup leaves an unregistered token behind, and its
    // holder still needs this page to verify or to sign in as someone else.
    if (isRegistered()) throw redirect({ to: '/account' })
  },
  component: LoginPage,
})

function LoginPage() {
  const { isVerifyPending, handleSuccess } = useAuthSuccess()

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
