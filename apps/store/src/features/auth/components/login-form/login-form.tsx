import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Form } from '#/components/form/form.tsx'
import { ButtonLink } from '#/components/ui/button/button'
import {
  loginForm,
  loginFormEmail,
  loginFormFields,
  loginFormForgotPassword,
  loginFormPassword,
  loginFormSubmit,
} from '#/features/auth/components/login-form/login-form.variants'
import type { LoginFormParams } from '#/features/auth/hooks/use-login-form'
import { useLoginForm } from '#/features/auth/hooks/use-login-form'
import type { LinkTarget } from '#/lib/link-target'

export function LoginForm({
  forgotPasswordLink,
  className,
  ...props
}: LoginFormParams & {
  /** FORGOT_PASSWORD. */
  forgotPasswordLink: LinkTarget
  className?: string
}) {
  const { form } = useLoginForm(props)
  const { t } = useLingui()

  return (
    <Form onSubmit={form.handleSubmit} className={cn(loginForm(), className)}>
      <form.AppForm>
        <div className={loginFormFields()}>
          <form.AppField name="email">
            {(field) => (
              <field.TextField
                label={t`Email`}
                type="email"
                autoComplete="email"
                autoFocus
                className={loginFormEmail()}
              />
            )}
          </form.AppField>
          <form.AppField name="password">
            {(field) => (
              <field.TextField
                label={t`Password`}
                type="password"
                autoComplete="current-password"
                className={loginFormPassword()}
              />
            )}
          </form.AppField>
        </div>
        <ButtonLink {...forgotPasswordLink} variant="link" size="lg" className={loginFormForgotPassword()}>
          <Trans>Forgot password?</Trans>
        </ButtonLink>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <form.SubmitButton size="lg" className={loginFormSubmit()}>
              {isSubmitting ? <Trans>Signing in...</Trans> : <Trans>Sign in</Trans>}
            </form.SubmitButton>
          )}
        </form.Subscribe>
      </form.AppForm>
    </Form>
  )
}
