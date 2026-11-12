import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Form } from '#/components/form/form.tsx'
import {
  forgotPasswordForm,
  forgotPasswordFormEmail,
  forgotPasswordFormFields,
  forgotPasswordFormSubmit,
} from '#/features/auth/components/forgot-password-form/forgot-password-form.variants'
import type { ForgotPasswordFormParams } from '#/features/auth/hooks/use-forgot-password-form'
import { useForgotPasswordForm } from '#/features/auth/hooks/use-forgot-password-form'

export function ForgotPasswordForm({ className, ...props }: ForgotPasswordFormParams & { className?: string }) {
  const { form } = useForgotPasswordForm(props)
  const { t } = useLingui()

  return (
    <Form onSubmit={form.handleSubmit} className={cn(forgotPasswordForm(), className)}>
      <form.AppForm>
        <div className={forgotPasswordFormFields()}>
          <form.AppField name="email">
            {(field) => (
              <field.TextField
                label={t`Email`}
                type="email"
                autoComplete="email"
                autoFocus
                className={forgotPasswordFormEmail()}
              />
            )}
          </form.AppField>
        </div>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <form.SubmitButton size="lg" className={forgotPasswordFormSubmit()}>
              {isSubmitting ? <Trans>Sending...</Trans> : <Trans>Send reset link</Trans>}
            </form.SubmitButton>
          )}
        </form.Subscribe>
      </form.AppForm>
    </Form>
  )
}
