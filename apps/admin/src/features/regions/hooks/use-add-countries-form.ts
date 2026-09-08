import { AdminAssignRegionCountries, type AdminAssignRegionCountriesBody } from '@proteus/http-schemas/admin'
import { formOptions } from '@tanstack/form-core'
import type { AdminRegionCountriesResponse } from '#/api/generated/model'
import { useAssignRegionCountries } from '#/features/regions/api/countries'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export type AddCountriesFormParams = SubmitFormParams<AdminRegionCountriesResponse>

/**
 * Shared with `CountryLocaleSelect`, which opens the per-country locale fields this form owns.
 *
 * The same schema the route validates against, so a locale the API would refuse is one the form
 * refuses first — reported on the row that carries it rather than as a 400 the merchant has to
 * interpret.
 */
export const addCountriesFormOpts = formOptions({
  defaultValues: {
    countries: [],
  } satisfies AdminAssignRegionCountriesBody as AdminAssignRegionCountriesBody,
  validators: { onSubmit: AdminAssignRegionCountries },
})

export function useAddCountriesForm(regionId: string, params?: AddCountriesFormParams) {
  const assignMutation = useAssignRegionCountries(regionId)

  const form = useAppForm({
    ...addCountriesFormOpts,
    onSubmit: async ({ value }) => {
      try {
        const data = await assignMutation.mutateAsync(value)
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
