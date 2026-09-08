import { AdminAddStoreCurrencies, type AdminAddStoreCurrenciesBody } from '@proteus/http-schemas/admin'
import type { AdminStoreResponse } from '#/api/generated/model'
import { useAddStoreCurrencies } from '#/features/store/api/store'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export type AddCurrenciesFormParams = SubmitFormParams<AdminStoreResponse>

export function useAddCurrenciesForm(params?: AddCurrenciesFormParams) {
  const addMutation = useAddStoreCurrencies()

  const form = useAppForm({
    defaultValues: {
      currencyCodes: [],
    } satisfies AdminAddStoreCurrenciesBody as AdminAddStoreCurrenciesBody,
    // The same schema the route validates against. Every code here comes from the runtime's own
    // ISO 4217 list, so the only value it can refuse is the empty selection — which the select
    // then reports on itself.
    validators: { onSubmit: AdminAddStoreCurrencies },
    onSubmit: async ({ value }) => {
      try {
        const data = await addMutation.mutateAsync(value)
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
