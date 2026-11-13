import { Trans, useLingui } from '@lingui/react/macro'
import { toast } from '@proteus/ui-core'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { ButtonLink } from '#/components/ui/button/button'
import { AuthHeading } from '#/features/auth/components/auth-heading/auth-heading'
import { LoginForm } from '#/features/auth/components/login-form/login-form'
import { VerifyPending } from '#/features/auth/components/verify-pending/verify-pending'
import { useAuthSuccess } from '#/features/auth/hooks/use-auth-success'
import { isRegistered } from '#/lib/auth-token'
import { flowLinks } from '#/navigation/links'

const links = flowLinks('LoginForm')

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
    // `?redirect` is a path the sign-in was asked from, kept as given: the map draws only checkout's.
    if (search.redirect) throw redirect({ to: search.redirect })
    throw redirect(links.ALREADY_SIGNED_IN())
  },
  component: LoginPage,
})

function LoginPage() {
  const { redirect: redirectTo } = Route.useSearch()
  const { isVerifyPending, handleSuccess } = useAuthSuccess({
    signedIn: redirectTo ? { to: redirectTo } : links.SIGNED_IN('AccountDetail'),
  })
  const { t } = useLingui()

  return (
    <main className="mt-10 flex w-full max-w-md flex-col items-center">
      {isVerifyPending ? (
        <VerifyPending signInLink={links.BACK_TO_SIGN_IN()} className="w-full" />
      ) : (
        <>
          <AuthHeading title={t`Sign in`}>
            <Trans>Track your orders, save your details, and check out faster.</Trans>
          </AuthHeading>
          <div className="mt-10 w-full">
            <LoginForm
              forgotPasswordLink={links.FORGOT_PASSWORD()}
              onSuccess={handleSuccess}
              onError={(error) => toast.add({ type: 'error', title: error })}
            />
          </div>
          <p className="mt-6 text-center text-ink-muted text-sm">
            <Trans>Don't have an account?</Trans>{' '}
            <ButtonLink {...links.SIGN_UP()} variant="link" className="align-baseline">
              <Trans>Sign up</Trans>
            </ButtonLink>
          </p>
        </>
      )}
    </main>
  )
}
