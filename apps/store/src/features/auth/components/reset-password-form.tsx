import { Form } from '#/components/form/form.tsx'
import type { ResetPasswordFormParams } from '#/features/auth/hooks/use-reset-password-form'
import { useResetPasswordForm } from '#/features/auth/hooks/use-reset-password-form'

export function ResetPasswordForm(props: ResetPasswordFormParams) {
  const { form, isPending } = useResetPasswordForm(props)

  return (
    <Form onSubmit={form.handleSubmit} className="w-full">
      <form.AppForm>
        <div className="flex w-full flex-col gap-y-2">
          <form.AppField name="password">
            {(field) => <field.TextField label="New password" type="password" autoComplete="new-password" autoFocus />}
          </form.AppField>
        </div>
        <form.SubmitButton isPending={isPending} className="mt-6 h-14 w-full font-semibold text-base">
          {isPending ? 'Updating...' : 'Set new password'}
        </form.SubmitButton>
      </form.AppForm>
    </Form>
  )
}
