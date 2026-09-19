import { AdminUpdateRole, type AdminUpdateRoleBody } from '@proteus/http-schemas/admin'
import type { AdminRoleDetailResponse, AdminRoleDetailResponseRole } from '#/api/generated/model'
import { useUpdateRole } from '#/features/access-control/api/roles'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export type EditRoleFormParams = SubmitFormParams<AdminRoleDetailResponse>

export function useEditRoleForm(role: AdminRoleDetailResponseRole, params?: EditRoleFormParams) {
  const updateMutation = useUpdateRole(role.id)

  const form = useAppForm({
    defaultValues: {
      name: role.name,
      description: role.description,
      features: role.features,
    } satisfies AdminUpdateRoleBody as AdminUpdateRoleBody,
    validators: { onSubmit: AdminUpdateRole },
    onSubmit: async ({ value }) => {
      try {
        const data = await updateMutation.mutateAsync(value)
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
