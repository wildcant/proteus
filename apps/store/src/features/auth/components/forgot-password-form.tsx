import { Trans, useLingui } from '@lingui/react/macro'
import { Form } from '#/components/form/form.tsx'
import type { ForgotPasswordFormParams } from '#/features/auth/hooks/use-forgot-password-form'
import { useForgotPasswordForm } from '#/features/auth/hooks/use-forgot-password-form'

export function ForgotPasswordForm(props: ForgotPasswordFormParams) {
  const { form } = useForgotPasswordForm(props)
  const { t } = useLingui()

  return (
    <Form onSubmit={form.handleSubmit} className="w-full">
      <form.AppForm>
        <div className="flex w-full flex-col gap-y-2">
          <form.AppField name="email">
            {(field) => <field.TextField label={t`Email`} type="email" autoComplete="email" autoFocus />}
          </form.AppField>
        </div>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <form.SubmitButton className="mt-6 h-14 w-full font-semibold text-base">
              {isSubmitting ? <Trans>Sending...</Trans> : <Trans>Send reset link</Trans>}
            </form.SubmitButton>
          )}
        </form.Subscribe>
      </form.AppForm>
    </Form>
  )
}
