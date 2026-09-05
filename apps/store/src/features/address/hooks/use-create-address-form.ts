import { StoreCreateAddress } from '@proteus/http-schemas/store'
import { PREFILL_FORMS } from '#/env.ts'
import { useCreateAddress } from '#/features/address/api/addresses'
import { addressFormOpts, EMPTY_ADDRESS, TEST_ADDRESS, toPayload } from '#/features/address/form-values'
import type { SubmitFormParams } from '#/lib/form'
import { useAppForm } from '#/lib/form-hook'
import { useMarket } from '#/lib/use-market'

export type CreateAddressFormParams = SubmitFormParams

export function useCreateAddressForm(params?: CreateAddressFormParams) {
  const createAddress = useCreateAddress()
  const { current } = useMarket()

  const form = useAppForm({
    ...addressFormOpts,
    // The country is not asked for, so it is answered here: an address saved in this market is an
    // address the store can ship to, and that is the only kind the book is allowed to gain.
    defaultValues: { ...(PREFILL_FORMS ? TEST_ADDRESS : EMPTY_ADDRESS), countryCode: current.iso2 },
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
