import { AdminAddStoreCurrencies, type AdminAddStoreCurrenciesBody } from '@proteus/http-schemas/admin'
import type { AdminStoreResponse } from '#/api/generated/model'
import { useAddStoreCurrencies } from '#/features/store/api/store'
import { useAppForm } from '#/lib/form-hook.ts'
import type { SubmitFormParams } from '#/types/form.ts'

export type AddCurrenciesFormParams = SubmitFormParams<AdminStoreResponse>

export function useAddCurrenciesForm(params?: AddCurrenciesFormParams) {
  const addMutation = useAddStoreCurrencies()

  const form = useAppForm({
    defaultValues: {
      currencyCodes: [],
    } satisfies AdminAddStoreCurrenciesBody as AdminAddStoreCurrenciesBody,
    // The same schema the route validates against. Every code here comes from the runtime's own
    // ISO 4217 list, so the only value it can refuse is the empty selection — which the Save
    // button already refuses, visibly.
    validators: { onSubmit: AdminAddStoreCurrencies },
    onSubmit: ({ value }) => {
      addMutation.mutate(value, {
        onSuccess: (data) => {
          form.reset()
          params?.onSuccess?.(data)
        },
        onError: (error) => params?.onError?.(error.message),
        onSettled: () => params?.onSettled?.(),
      })
    },
  })

  return { form, isLoading: addMutation.isPending }
}
