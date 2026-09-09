import { AdminUpdateStore, type AdminUpdateStoreBody } from '@proteus/http-schemas/admin'
import type { AdminStore, AdminStoreResponse } from '#/api/generated/model'
import { useUpdateStore } from '#/features/store/api/store'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export type EditStoreFormParams = SubmitFormParams<AdminStoreResponse>

export function useEditStoreForm(store: AdminStore, params?: EditStoreFormParams) {
  const updateMutation = useUpdateStore()

  const form = useAppForm({
    defaultValues: {
      name: store.name,
      // Both fields are always sent, so clearing the region arrives as `null` rather than as an
      // omission the API would read as "leave it alone" — which is the only way to say "no default".
      defaultRegionId: store.defaultRegionId,
    } satisfies AdminUpdateStoreBody as AdminUpdateStoreBody,
    // The same schema the route validates against, so a value the API would refuse is one the form
    // refuses first — with the field named rather than as a 400 the merchant has to interpret.
    validators: { onSubmit: AdminUpdateStore },
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
