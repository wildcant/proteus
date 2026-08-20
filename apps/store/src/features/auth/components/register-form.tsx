import { Button } from '#/components/button'
import type { RegisterFormParams } from '#/features/auth/hooks/use-register-form'
import { useRegisterForm } from '#/features/auth/hooks/use-register-form'

export function RegisterForm(props: RegisterFormParams) {
  const { form, isPending } = useRegisterForm(props)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        form.handleSubmit()
      }}
      className="flex w-full flex-col"
    >
      <div className="flex w-full flex-col gap-y-2">
        <form.AppField name="firstName">
          {(field) => <field.TextField label="First name" autoComplete="given-name" />}
        </form.AppField>
        <form.AppField name="lastName">
          {(field) => <field.TextField label="Last name" autoComplete="family-name" />}
        </form.AppField>
        <form.AppField name="email">
          {(field) => <field.TextField label="Email" type="email" autoComplete="email" />}
        </form.AppField>
        <form.AppField name="password">
          {(field) => <field.TextField label="Password" type="password" autoComplete="new-password" />}
        </form.AppField>
      </div>
      <span className="mt-6 text-center text-(--foreground-muted) text-xs">
        By creating an account, you agree to our Privacy Policy and Terms of Use.
      </span>
      <Button type="submit" disabled={isPending} className="mt-6 w-full">
        {isPending ? 'Creating account...' : 'Join'}
      </Button>
    </form>
  )
}
