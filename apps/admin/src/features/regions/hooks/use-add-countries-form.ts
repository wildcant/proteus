import { AdminAssignRegionCountries, type AdminAssignRegionCountriesBody } from '@proteus/http-schemas/admin'
import type { AdminRegionCountriesResponse } from '#/api/generated/model'
import { useAssignRegionCountries } from '#/features/regions/api/countries'
import { useAppForm } from '#/lib/form-hook.ts'
import type { SubmitFormParams } from '#/types/form.ts'

export type AddCountriesFormParams = SubmitFormParams<AdminRegionCountriesResponse>

export function useAddCountriesForm(regionId: string, params?: AddCountriesFormParams) {
  const assignMutation = useAssignRegionCountries(regionId)

  const form = useAppForm({
    defaultValues: {
      countries: [],
    } satisfies AdminAssignRegionCountriesBody as AdminAssignRegionCountriesBody,
    // The same schema the route validates against, so a locale the API would refuse is one the form
    // refuses first — with the field named rather than as a 400 the merchant has to interpret.
    validators: { onSubmit: AdminAssignRegionCountries },
    onSubmit: ({ value }) => {
      assignMutation.mutate(value, {
        onSuccess: (data) => {
          form.reset()
          params?.onSuccess?.(data)
        },
        onError: (error) => params?.onError?.(error.message),
        onSettled: () => params?.onSettled?.(),
      })
    },
  })

  return { form, isLoading: assignMutation.isPending }
}
