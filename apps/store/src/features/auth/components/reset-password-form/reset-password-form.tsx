import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Form } from '#/components/form/form.tsx'
import {
  resetPasswordForm,
  resetPasswordFormFields,
  resetPasswordFormPassword,
  resetPasswordFormSubmit,
} from '#/features/auth/components/reset-password-form/reset-password-form.variants'
import type { ResetPasswordFormParams } from '#/features/auth/hooks/use-reset-password-form'
import { useResetPasswordForm } from '#/features/auth/hooks/use-reset-password-form'

export function ResetPasswordForm({ className, ...props }: ResetPasswordFormParams & { className?: string }) {
  const { form } = useResetPasswordForm(props)
  const { t } = useLingui()

  return (
    <Form onSubmit={form.handleSubmit} className={cn(resetPasswordForm(), className)}>
      <form.AppForm>
        <div className={resetPasswordFormFields()}>
          <form.AppField name="password">
            {(field) => (
              <field.TextField
                label={t`New password`}
                type="password"
                autoComplete="new-password"
                autoFocus
                className={resetPasswordFormPassword()}
              />
            )}
          </form.AppField>
        </div>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <form.SubmitButton size="lg" className={resetPasswordFormSubmit()}>
              {isSubmitting ? <Trans>Updating...</Trans> : <Trans>Set new password</Trans>}
            </form.SubmitButton>
          )}
        </form.Subscribe>
      </form.AppForm>
    </Form>
  )
}
