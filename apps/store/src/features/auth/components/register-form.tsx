import { Trans, useLingui } from '@lingui/react/macro'
import { Form } from '#/components/form/form.tsx'
import type { RegisterFormParams } from '#/features/auth/hooks/use-register-form'
import { useRegisterForm } from '#/features/auth/hooks/use-register-form'

export function RegisterForm(props: RegisterFormParams) {
  const { form } = useRegisterForm(props)
  const { t } = useLingui()

  return (
    <Form onSubmit={form.handleSubmit} className="flex w-full flex-col">
      <form.AppForm>
        <div className="flex w-full flex-col gap-y-2">
          <form.AppField name="firstName">
            {(field) => <field.TextField label={t`First name`} autoComplete="given-name" />}
          </form.AppField>
          <form.AppField name="lastName">
            {(field) => <field.TextField label={t`Last name`} autoComplete="family-name" />}
          </form.AppField>
          <form.AppField name="email">
            {(field) => <field.TextField label={t`Email`} type="email" autoComplete="email" />}
          </form.AppField>
          <form.AppField name="password">
            {(field) => <field.TextField label={t`Password`} type="password" autoComplete="new-password" />}
          </form.AppField>
        </div>
        <span className="mt-6 text-center text-ink-muted text-xs">
          <Trans>By creating an account, you agree to our Privacy Policy and Terms of Use.</Trans>
        </span>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <form.SubmitButton className="mt-6 h-14 w-full font-semibold text-base">
              {isSubmitting ? <Trans>Creating account...</Trans> : <Trans>Create account</Trans>}
            </form.SubmitButton>
          )}
        </form.Subscribe>
      </form.AppForm>
    </Form>
  )
}
