import { UpdatePasswordBody } from '@proteus/http-schemas/auth'
import { useUpdatePassword } from '#/features/auth/api/auth'
import { errorMessage, type SubmitFormParams } from '#/lib/form'
import { useAppForm } from '#/lib/form-hook'

export type ResetPasswordFormParams = SubmitFormParams & { token: string }

export function useResetPasswordForm({ token, ...params }: ResetPasswordFormParams) {
  const updateMutation = useUpdatePassword()

  const form = useAppForm({
    defaultValues: { password: '' },
    validators: { onSubmit: UpdatePasswordBody },
    onSubmit: async ({ value }) => {
      try {
        await updateMutation.mutateAsync({ ...value, token })
        form.reset()
        params.onSuccess?.()
      } catch (error) {
        params.onError?.(errorMessage(error))
      } finally {
        params.onSettled?.()
      }
    },
  })

  return { form }
}
