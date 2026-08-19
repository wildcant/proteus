import { Button } from '#/components/button'
import type { ResetPasswordFormParams } from '#/features/auth/hooks/use-reset-password-form'
import { useResetPasswordForm } from '#/features/auth/hooks/use-reset-password-form'

export function ResetPasswordForm(props: ResetPasswordFormParams) {
  const { form, isPending } = useResetPasswordForm(props)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        form.handleSubmit()
      }}
      className="w-full"
    >
      <div className="flex w-full flex-col gap-y-2">
        <form.AppField name="password">
          {(field) => <field.TextField label="New password" type="password" autoComplete="new-password" autoFocus />}
        </form.AppField>
      </div>
      <Button type="submit" disabled={isPending} className="mt-6 w-full">
        {isPending ? 'Updating...' : 'Set new password'}
      </Button>
    </form>
  )
}
