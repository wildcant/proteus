import { toast } from '@proteus/ui'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Button } from '#/components/button'
import { AuthHeading } from '#/features/auth/components/auth-heading'
import { RegisterForm } from '#/features/auth/components/register-form'
import { VerifyPending } from '#/features/auth/components/verify-pending'
import { useAuthSuccess } from '#/features/auth/hooks/use-auth-success'
import { isRegistered } from '#/lib/auth-token'

export const Route = createFileRoute('/_auth/signup')({
  beforeLoad: () => {
    // isRegistered, not getToken: signup leaves an unregistered token behind, and its
    // holder still needs this page to verify or to sign in as someone else.
    if (isRegistered()) throw redirect({ to: '/account' })
  },
  component: SignupPage,
})

function SignupPage() {
  const { isVerifyPending, handleSuccess } = useAuthSuccess()

  return (
    <main className="mt-10 flex w-full max-w-md flex-col items-center">
      {isVerifyPending ? (
        <VerifyPending />
      ) : (
        <>
          <AuthHeading title="Sign up">
            Create an account to track your orders, save your details, and check out faster.
          </AuthHeading>
          <div className="mt-10 w-full">
            <RegisterForm onSuccess={handleSuccess} onError={(error) => toast.add({ type: 'error', title: error })} />
          </div>
          <p className="mt-6 text-center text-ink-muted text-sm">
            Already have an account?{' '}
            <Button variant="link" render={<Link to="/login" />} className="align-baseline text-sm">
              Sign in
            </Button>
          </p>
        </>
      )}
    </main>
  )
}
