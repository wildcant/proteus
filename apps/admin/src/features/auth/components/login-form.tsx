import { Form } from '#/components/form/form.tsx'
import type { LoginFormParams } from '#/features/auth/hooks/use-login-form'
import { useLoginForm } from '#/features/auth/hooks/use-login-form'

export function LoginForm(props: LoginFormParams) {
  const { form } = useLoginForm(props)

  return (
    <Form onSubmit={form.handleSubmit} className="flex flex-col gap-4">
      <form.AppForm>
        <form.AppField name="email">
          {(field) => <field.TextField label="Email" type="email" autoComplete="email" autoFocus hideLabel />}
        </form.AppField>
        <form.AppField name="password">
          {(field) => <field.TextField label="Password" type="password" autoComplete="current-password" hideLabel />}
        </form.AppField>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => <form.SubmitButton>{isSubmitting ? 'Signing in...' : 'Sign in'}</form.SubmitButton>}
        </form.Subscribe>
      </form.AppForm>
    </Form>
  )
}
