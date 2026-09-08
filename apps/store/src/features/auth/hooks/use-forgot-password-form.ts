import { ResetPasswordBody } from '@proteus/http-schemas/auth'
import { useRequestPasswordReset } from '#/features/auth/api/auth'
import { errorMessage, type SubmitFormParams } from '#/lib/form'
import { useAppForm } from '#/lib/form-hook'

export type ForgotPasswordFormParams = SubmitFormParams

export function useForgotPasswordForm(params?: ForgotPasswordFormParams) {
  const resetMutation = useRequestPasswordReset()

  const form = useAppForm({
    defaultValues: { email: '' },
    validators: { onSubmit: ResetPasswordBody },
    onSubmit: async ({ value }) => {
      try {
        await resetMutation.mutateAsync(value)
        form.reset()
        params?.onSuccess?.()
      } catch (error) {
        params?.onError?.(errorMessage(error))
      } finally {
        params?.onSettled?.()
      }
    },
  })

  return { form }
}
