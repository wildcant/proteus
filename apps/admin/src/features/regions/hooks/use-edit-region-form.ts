import { AdminUpdateRegion, type AdminUpdateRegionBody } from '@proteus/http-schemas/admin'
import type { AdminRegion, AdminRegionResponse } from '#/api/generated/model'
import { useUpdateRegion } from '#/features/regions/api/regions'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export type EditRegionFormParams = SubmitFormParams<AdminRegionResponse>

export function useEditRegionForm(region: AdminRegion, params?: EditRegionFormParams) {
  const updateMutation = useUpdateRegion(region.id)

  const form = useAppForm({
    defaultValues: {
      name: region.name,
      currencyCode: region.currencyCode,
      // The whole set, because saving replaces it: a provider the merchant clears has to arrive
      // as an absence rather than as an omission the API would read as "leave them alone".
      paymentProviderIds: region.paymentProviders.map((provider) => provider.id),
    } satisfies AdminUpdateRegionBody as AdminUpdateRegionBody,
    validators: { onSubmit: AdminUpdateRegion },
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
