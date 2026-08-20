import { AddCartShippingMethod } from '@proteus/http-schemas/store'
import type { AddStoreCartShippingMethodBody } from '#/api/generated/model'
import { useSelectShippingMethod } from '#/features/checkout/api/checkout'
import type { SubmitFormParams } from '#/lib/form'
import { useAppForm } from '#/lib/form-hook'

export type ShippingMethodFormParams = SubmitFormParams & {
  defaultValues?: AddStoreCartShippingMethodBody
}

export function useShippingMethodForm(params?: ShippingMethodFormParams) {
  const selectMethod = useSelectShippingMethod()

  const form = useAppForm({
    defaultValues: params?.defaultValues ?? { shippingOptionId: '' },
    validators: { onSubmit: AddCartShippingMethod },
    onSubmit: async ({ value }) => {
      selectMethod.mutate(value, {
        onSuccess: () => params?.onSuccess?.(),
        onError: (error) => params?.onError?.(error.message),
        onSettled: () => params?.onSettled?.(),
      })
    },
  })

  return { form, isPending: selectMethod.isPending, error: selectMethod.error }
}
