import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Form } from '#/components/form/form.tsx'
import {
  registerForm,
  registerFormConsent,
  registerFormEmail,
  registerFormFields,
  registerFormFirstName,
  registerFormLastName,
  registerFormPassword,
  registerFormSubmit,
} from '#/features/auth/components/register-form/register-form.variants'
import type { RegisterFormParams } from '#/features/auth/hooks/use-register-form'
import { useRegisterForm } from '#/features/auth/hooks/use-register-form'

export function RegisterForm({ className, ...props }: RegisterFormParams & { className?: string }) {
  const { form } = useRegisterForm(props)
  const { t } = useLingui()

  return (
    <Form onSubmit={form.handleSubmit} className={cn(registerForm(), className)}>
      <form.AppForm>
        <div className={registerFormFields()}>
          <form.AppField name="firstName">
            {(field) => (
              <field.TextField label={t`First name`} autoComplete="given-name" className={registerFormFirstName()} />
            )}
          </form.AppField>
          <form.AppField name="lastName">
            {(field) => (
              <field.TextField label={t`Last name`} autoComplete="family-name" className={registerFormLastName()} />
            )}
          </form.AppField>
          <form.AppField name="email">
            {(field) => (
              <field.TextField label={t`Email`} type="email" autoComplete="email" className={registerFormEmail()} />
            )}
          </form.AppField>
          <form.AppField name="password">
            {(field) => (
              <field.TextField
                label={t`Password`}
                type="password"
                autoComplete="new-password"
                className={registerFormPassword()}
              />
            )}
          </form.AppField>
        </div>
        <span className={registerFormConsent()}>
          <Trans>By creating an account, you agree to our Privacy Policy and Terms of Use.</Trans>
        </span>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <form.SubmitButton size="lg" className={registerFormSubmit()}>
              {isSubmitting ? <Trans>Creating account...</Trans> : <Trans>Create account</Trans>}
            </form.SubmitButton>
          )}
        </form.Subscribe>
      </form.AppForm>
    </Form>
  )
}
