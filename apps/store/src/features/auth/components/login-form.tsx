import { Trans, useLingui } from '@lingui/react/macro'
import { ButtonLink } from '#/components/button'
import { Form } from '#/components/form/form.tsx'
import type { LoginFormParams } from '#/features/auth/hooks/use-login-form'
import { useLoginForm } from '#/features/auth/hooks/use-login-form'

export function LoginForm(props: LoginFormParams) {
  const { form } = useLoginForm(props)
  const { t } = useLingui()

  return (
    <Form onSubmit={form.handleSubmit} className="w-full">
      <form.AppForm>
        <div className="flex w-full flex-col gap-y-2">
          <form.AppField name="email">
            {(field) => <field.TextField label={t`Email`} type="email" autoComplete="email" autoFocus />}
          </form.AppField>
          <form.AppField name="password">
            {(field) => <field.TextField label={t`Password`} type="password" autoComplete="current-password" />}
          </form.AppField>
        </div>
        <ButtonLink variant="link" to="/forgot-password" className="mt-6 w-full justify-center text-base">
          <Trans>Forgot password?</Trans>
        </ButtonLink>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <form.SubmitButton className="mt-6 h-14 w-full font-semibold text-base">
              {isSubmitting ? <Trans>Signing in...</Trans> : <Trans>Sign in</Trans>}
            </form.SubmitButton>
          )}
        </form.Subscribe>
      </form.AppForm>
    </Form>
  )
}
