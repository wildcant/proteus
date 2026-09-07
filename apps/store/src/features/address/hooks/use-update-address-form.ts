import { StoreUpdateAddress } from '@proteus/http-schemas/store'
import type { StoreCustomerAddress } from '#/api/generated/model'
import { useUpdateAddress } from '#/features/address/api/addresses'
import { addressFormOpts, toFormValues, toPayload } from '#/features/address/utils/form-values'
import type { SubmitFormParams } from '#/lib/form'
import { useAppForm } from '#/lib/form-hook'

export type UpdateAddressFormParams = SubmitFormParams

export function useUpdateAddressForm(address: StoreCustomerAddress, params?: UpdateAddressFormParams) {
  const updateAddress = useUpdateAddress()

  const form = useAppForm({
    ...addressFormOpts,
    // No `PREFILL_FORMS` fork here, unlike the create form: the shopper is editing a row that
    // already exists, so test values would overwrite the very thing they opened the drawer for.
    defaultValues: toFormValues(address),
    // PATCH makes every field optional on the wire, which is right for the endpoint and wrong for
    // this form: the shopper is editing a whole address, so the four a courier needs are required
    // again. Same move as `AdminUpdateProduct.required({ title: true })`.
    validators: {
      onSubmit: StoreUpdateAddress.required({ address1: true, city: true, countryCode: true, postalCode: true }),
    },
    onSubmit: ({ value }) => {
      updateAddress.mutate(
        { addressId: address.id, payload: toPayload(value) },
        {
          onSuccess: () => params?.onSuccess?.(),
          onError: (error) => params?.onError?.(error.message),
          onSettled: () => params?.onSettled?.(),
        },
      )
    },
  })

  return { form, isPending: updateAddress.isPending }
}
