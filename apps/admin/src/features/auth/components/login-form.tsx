import { Button } from '@proteus/ui'
import type { LoginFormParams } from '#/features/auth/hooks/use-login-form'
import { useLoginForm } from '#/features/auth/hooks/use-login-form'

export function LoginForm(props: LoginFormParams) {
  const { form, isPending } = useLoginForm(props)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        form.handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      <form.AppField name="email">
        {(field) => <field.TextField label="Email" type="email" autoComplete="email" autoFocus hideLabel />}
      </form.AppField>
      <form.AppField name="password">
        {(field) => <field.TextField label="Password" type="password" autoComplete="current-password" hideLabel />}
      </form.AppField>
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  )
}
