import { useLingui } from '@lingui/react/macro'
import { useRouteModal } from '@proteus/ui'
import { AddressForm } from '#/features/address/components/address-form'
import { useCreateAddressForm } from '#/features/address/hooks/use-create-address-form'

export function CreateAddressForm() {
  const { t } = useLingui()
  const { handleSuccess } = useRouteModal()
  const { form } = useCreateAddressForm({ onSuccess: () => handleSuccess() })

  return <AddressForm form={form} title={t`Add an address`} />
}
