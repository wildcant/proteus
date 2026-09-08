import { Form } from '#/components/form/form.tsx'
import type { ForgotPasswordFormParams } from '#/features/auth/hooks/use-forgot-password-form'
import { useForgotPasswordForm } from '#/features/auth/hooks/use-forgot-password-form'

export function ForgotPasswordForm(props: ForgotPasswordFormParams) {
  const { form, isPending } = useForgotPasswordForm(props)

  return (
    <Form onSubmit={form.handleSubmit} className="w-full">
      <form.AppForm>
        <div className="flex w-full flex-col gap-y-2">
          <form.AppField name="email">
            {(field) => <field.TextField label="Email" type="email" autoComplete="email" autoFocus />}
          </form.AppField>
        </div>
        <form.SubmitButton isPending={isPending} className="mt-6 h-14 w-full font-semibold text-base">
          {isPending ? 'Sending...' : 'Send reset link'}
        </form.SubmitButton>
      </form.AppForm>
    </Form>
  )
}
