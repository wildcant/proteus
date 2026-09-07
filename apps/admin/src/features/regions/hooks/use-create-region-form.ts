import { AdminCreateRegion, type AdminCreateRegionBody } from '@proteus/http-schemas/admin'
import type { AdminRegionResponse } from '#/api/generated/model'
import { useCreateRegion } from '#/features/regions/api/regions'
import { useAppForm } from '#/lib/form-hook.ts'
import type { SubmitFormParams } from '#/types/form.ts'

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
    onSubmit: ({ value }) => {
      createMutation.mutate(value, {
        onSuccess: (data) => {
          form.reset()
          params?.onSuccess?.(data)
        },
        onError: (error) => params?.onError?.(error.message),
        onSettled: () => params?.onSettled?.(),
      })
    },
  })

  return { form, isLoading: createMutation.isPending }
}
