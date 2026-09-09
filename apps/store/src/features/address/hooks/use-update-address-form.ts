import { StoreUpdateAddress } from '@proteus/http-schemas/store'
import type { StoreCustomerAddress } from '#/api/generated/model'
import { useUpdateAddress } from '#/features/address/api/addresses'
import { addressFormOpts, toFormValues, toPayload } from '#/features/address/utils/form-values'
import { errorMessage, type SubmitFormParams } from '#/lib/form'
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
    onSubmit: async ({ value }) => {
      try {
        await updateAddress.mutateAsync({ addressId: address.id, payload: toPayload(value) })
        params?.onSuccess?.()
      } catch (error) {
        params?.onError?.(errorMessage(error))
      } finally {
        params?.onSettled?.()
      }
    },
  })

  return { form }
}
