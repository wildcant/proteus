import { AdminCreateRegion, type AdminCreateRegionBody } from '@proteus/http-schemas/admin'
import type { AdminRegionResponse } from '#/api/generated/model'
import { useCreateRegion } from '#/features/regions/api/regions'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export type CreateRegionFormParams = SubmitFormParams<AdminRegionResponse>

export function useCreateRegionForm(params?: CreateRegionFormParams) {
  const createMutation = useCreateRegion()

  const form = useAppForm({
    defaultValues: {
      name: '',
      currencyCode: '',
      paymentProviderIds: [],
    } satisfies AdminCreateRegionBody as AdminCreateRegionBody,
    validators: { onSubmit: AdminCreateRegion },
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
