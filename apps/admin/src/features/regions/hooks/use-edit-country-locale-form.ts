import { AdminUpdateCountryLocale, type AdminUpdateCountryLocaleBody } from '@proteus/http-schemas/admin'
import type { AdminCountry, AdminCountryResponse } from '#/api/generated/model'
import { useUpdateCountryLocale } from '#/features/regions/api/countries'
import { useAppForm } from '#/lib/form-hook.ts'
import type { SubmitFormParams } from '#/types/form.ts'

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
    onSubmit: ({ value }) => {
      updateMutation.mutate(value, {
        onSuccess: (data) => params?.onSuccess?.(data),
        onError: (error) => params?.onError?.(error.message),
        onSettled: () => params?.onSettled?.(),
      })
    },
  })

  return { form, isLoading: updateMutation.isPending }
}
