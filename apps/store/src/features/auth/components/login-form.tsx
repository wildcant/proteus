import { Link } from '@tanstack/react-router'
import { Button } from '#/components/button'
import { Form } from '#/components/form/form.tsx'
import type { LoginFormParams } from '#/features/auth/hooks/use-login-form'
import { useLoginForm } from '#/features/auth/hooks/use-login-form'

export function LoginForm(props: LoginFormParams) {
  const { form, isPending } = useLoginForm(props)

  return (
    <Form onSubmit={form.handleSubmit} className="w-full">
      <div className="flex w-full flex-col gap-y-2">
        <form.AppField name="email">
          {(field) => <field.TextField label="Email" type="email" autoComplete="email" autoFocus />}
        </form.AppField>
        <form.AppField name="password">
          {(field) => <field.TextField label="Password" type="password" autoComplete="current-password" />}
        </form.AppField>
      </div>
      <Button variant="link" render={<Link to="/forgot-password" />} className="mt-6 w-full justify-center text-base">
        Forgot password?
      </Button>
      <Button type="submit" disabled={isPending} className="mt-6 h-14 w-full font-semibold text-base">
        {isPending ? 'Signing in...' : 'Sign in'}
      </Button>
    </Form>
  )
}
