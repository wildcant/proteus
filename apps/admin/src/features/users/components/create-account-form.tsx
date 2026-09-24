import { Trans, useLingui } from '@lingui/react/macro'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { Form } from '#/components/form/form.tsx'
import { useCreateAccountForm } from '#/features/users/hooks/use-create-account-form'

type CreateAccountFormProps = {
  token: string
  email: string
  onSuccess: () => void
}

export function CreateAccountForm({ token, email, onSuccess }: CreateAccountFormProps) {
  const { t } = useLingui()
  const { form } = useCreateAccountForm({
    token,
    onSuccess,
  })

  return (
    <div className="w-full max-w-sm px-4">
      <Card>
        <CardHeader>
          <CardTitle>
            <Trans>Create your account</Trans>
          </CardTitle>
          <CardDescription>
            <Trans>Fill in your details to accept the invitation.</Trans>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form onSubmit={form.handleSubmit} className="flex flex-col gap-4">
            <form.AppForm>
              <div className="flex flex-col gap-1">
                <span className="font-medium text-muted-foreground text-sm">
                  <Trans>Email</Trans>
                </span>
                <span className="text-sm">{email}</span>
              </div>
              <form.AppField name="name">
                {(field) => <field.TextField label={t`Name`} autoComplete="name" autoFocus />}
              </form.AppField>
              <form.AppField name="password">
                {(field) => <field.TextField label={t`Password`} type="password" autoComplete="new-password" />}
              </form.AppField>
              <form.AppField name="confirmPassword">
                {(field) => <field.TextField label={t`Confirm password`} type="password" autoComplete="new-password" />}
              </form.AppField>
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <form.SubmitButton>{isSubmitting ? t`Creating account...` : t`Create account`}</form.SubmitButton>
                )}
              </form.Subscribe>
            </form.AppForm>
          </Form>
          <div className="mt-4 text-center">
            <Link to="/login" className="text-muted-foreground text-sm hover:text-foreground">
              <Trans>Back to login</Trans>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
