import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { useCreateAccountForm } from '#/features/users/hooks/use-create-account-form'

type CreateAccountFormProps = {
  token: string
  email: string
  onSuccess: () => void
}

export function CreateAccountForm({ token, email, onSuccess }: CreateAccountFormProps) {
  const { form, isPending } = useCreateAccountForm({
    token,
    onSuccess,
  })

  return (
    <div className="w-full max-w-sm px-4">
      <Card>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Fill in your details to accept the invitation.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              form.handleSubmit()
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1">
              <span className="font-medium text-muted-foreground text-sm">Email</span>
              <span className="text-sm">{email}</span>
            </div>
            <form.AppField name="name">
              {(field) => <field.TextField label="Name" autoComplete="name" autoFocus />}
            </form.AppField>
            <form.AppField name="password">
              {(field) => <field.TextField label="Password" type="password" autoComplete="new-password" />}
            </form.AppField>
            <form.AppField name="confirmPassword">
              {(field) => <field.TextField label="Confirm password" type="password" autoComplete="new-password" />}
            </form.AppField>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Link to="/login" className="text-muted-foreground text-sm hover:text-foreground">
              Back to login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
