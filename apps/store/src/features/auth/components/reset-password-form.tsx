import { Form } from '#/components/form/form.tsx'
import type { ResetPasswordFormParams } from '#/features/auth/hooks/use-reset-password-form'
import { useResetPasswordForm } from '#/features/auth/hooks/use-reset-password-form'

export function ResetPasswordForm(props: ResetPasswordFormParams) {
  const { form } = useResetPasswordForm(props)

  return (
    <Form onSubmit={form.handleSubmit} className="w-full">
      <form.AppForm>
        <div className="flex w-full flex-col gap-y-2">
          <form.AppField name="password">
            {(field) => <field.TextField label="New password" type="password" autoComplete="new-password" autoFocus />}
          </form.AppField>
        </div>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <form.SubmitButton className="mt-6 h-14 w-full font-semibold text-base">
              {isSubmitting ? 'Updating...' : 'Set new password'}
            </form.SubmitButton>
          )}
        </form.Subscribe>
      </form.AppForm>
    </Form>
  )
}
