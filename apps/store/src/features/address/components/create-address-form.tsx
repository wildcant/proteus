import { useRouteModal } from '@proteus/ui'
import { AddressForm } from '#/features/address/components/address-form'
import { useCreateAddressForm } from '#/features/address/hooks/use-create-address-form'

export function CreateAddressForm() {
  const { handleSuccess } = useRouteModal()
  const { form, isPending } = useCreateAddressForm({ onSuccess: () => handleSuccess() })

  return <AddressForm form={form} title="Add an address" isPending={isPending} />
}
