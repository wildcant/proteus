import { AdminCreateInvite } from '@proteus/http-schemas/admin'
import type { AdminInviteResponse } from '#/api/generated/model'
import { useCreateInvite } from '#/features/users/api/invites'
import { useAppForm } from '#/lib/form-hook'
import { errorMessage, type SubmitFormParams } from '#/types/form'

export type InviteFormParams = SubmitFormParams<AdminInviteResponse>

export function useInviteForm(params?: InviteFormParams) {
  const createMutation = useCreateInvite()

  const form = useAppForm({
    defaultValues: { email: '' },
    validators: { onSubmit: AdminCreateInvite },
    onSubmit: async ({ value }) => {
      try {
        const data = await createMutation.mutateAsync(value)
        form.reset()
        params?.onSuccess?.(data)
      } catch (error) {
        params?.onError?.(errorMessage(error))
      } finally {
        params?.onSettled?.()
      }
    },
  })

  return { form }
}
