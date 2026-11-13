import { Trans, useLingui } from '@lingui/react/macro'
import { toast } from '@proteus/ui-core'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { ButtonLink } from '#/components/ui/button/button'
import { AuthHeading } from '#/features/auth/components/auth-heading/auth-heading'
import { RegisterForm } from '#/features/auth/components/register-form/register-form'
import { VerifyPending } from '#/features/auth/components/verify-pending/verify-pending'
import { useAuthSuccess } from '#/features/auth/hooks/use-auth-success'
import { isRegistered } from '#/lib/auth-token'
import { flowLinks } from '#/navigation/links'

const links = flowLinks('RegisterForm')

export const Route = createFileRoute('/_auth/signup')({
  beforeLoad: () => {
    // isRegistered, not getToken: signup leaves an unregistered token behind, and its
    // holder still needs this page to verify or to sign in as someone else.
    if (isRegistered()) throw redirect(links.ALREADY_SIGNED_IN())
  },
  component: SignupPage,
})

function SignupPage() {
  const { isVerifyPending, handleSuccess } = useAuthSuccess({ signedIn: links.SIGNED_UP('AccountDetail') })
  const { t } = useLingui()

  return (
    <main className="mt-10 flex w-full max-w-md flex-col items-center">
      {isVerifyPending ? (
        <VerifyPending signInLink={links.BACK_TO_SIGN_IN()} className="w-full" />
      ) : (
        <>
          <AuthHeading title={t`Sign up`}>
            <Trans>Create an account to track your orders, save your details, and check out faster.</Trans>
          </AuthHeading>
          <div className="mt-10 w-full">
            <RegisterForm onSuccess={handleSuccess} onError={(error) => toast.add({ type: 'error', title: error })} />
          </div>
          <p className="mt-6 text-center text-ink-muted text-sm">
            <Trans>Already have an account?</Trans>{' '}
            <ButtonLink {...links.SIGN_IN()} variant="link" className="align-baseline">
              <Trans>Sign in</Trans>
            </ButtonLink>
          </p>
        </>
      )}
    </main>
  )
}
