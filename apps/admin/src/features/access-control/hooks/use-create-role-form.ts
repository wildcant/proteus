import { AdminCreateRole, type AdminCreateRoleBody } from '@proteus/http-schemas/admin'
import type { AdminRoleResponse } from '#/api/generated/model'
import { useCreateRole } from '#/features/access-control/api/roles'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export type CreateRoleFormParams = SubmitFormParams<AdminRoleResponse>

export function useCreateRoleForm(params?: CreateRoleFormParams) {
  const createMutation = useCreateRole()

  const form = useAppForm({
    defaultValues: {
      name: '',
      features: [],
    } satisfies AdminCreateRoleBody as AdminCreateRoleBody,
    validators: { onSubmit: AdminCreateRole },
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
