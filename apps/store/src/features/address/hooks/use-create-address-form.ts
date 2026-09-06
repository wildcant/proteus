import { StoreCreateAddress } from '@proteus/http-schemas/store'
import { PREFILL_FORMS } from '#/env.ts'
import { useCreateAddress } from '#/features/address/api/addresses'
import { addressFormOpts, EMPTY_ADDRESS, TEST_ADDRESS, toPayload } from '#/features/address/utils/form-values'
import type { SubmitFormParams } from '#/lib/form'
import { useAppForm } from '#/lib/form-hook'

export type CreateAddressFormParams = SubmitFormParams

export function useCreateAddressForm(params?: CreateAddressFormParams) {
  const createAddress = useCreateAddress()

  const form = useAppForm({
    ...addressFormOpts,
    defaultValues: PREFILL_FORMS ? TEST_ADDRESS : EMPTY_ADDRESS,
    // The endpoint's own schema. It requires the four fields a courier needs and leaves the rest
    // nullish, which is also what `isFieldRequired` reads to put the asterisks on the right labels.
    validators: { onSubmit: StoreCreateAddress },
    onSubmit: ({ value }) => {
      createAddress.mutate(toPayload(value), {
        onSuccess: () => params?.onSuccess?.(),
        onError: (error) => params?.onError?.(error.message),
        onSettled: () => params?.onSettled?.(),
      })
    },
  })

  return { form, isPending: createAddress.isPending }
}
