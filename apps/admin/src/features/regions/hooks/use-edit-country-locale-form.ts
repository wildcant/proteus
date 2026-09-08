import { AdminUpdateCountryLocale, type AdminUpdateCountryLocaleBody } from '@proteus/http-schemas/admin'
import type { AdminCountry, AdminCountryResponse } from '#/api/generated/model'
import { useUpdateCountryLocale } from '#/features/regions/api/countries'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export type EditCountryLocaleFormParams = SubmitFormParams<AdminCountryResponse>

export function useEditCountryLocaleForm(
  regionId: string,
  country: AdminCountry,
  params?: EditCountryLocaleFormParams,
) {
  const updateMutation = useUpdateCountryLocale(regionId, country.id)

  const form = useAppForm({
    defaultValues: {
      localeCode: country.localeCode ?? '',
    } satisfies AdminUpdateCountryLocaleBody as AdminUpdateCountryLocaleBody,
    validators: { onSubmit: AdminUpdateCountryLocale },
    onSubmit: async ({ value }) => {
      try {
        const data = await updateMutation.mutateAsync(value)
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
