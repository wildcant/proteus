import { useLingui } from '@lingui/react/macro'
import { useRouteModal } from '@proteus/ui'
import type { StoreCustomerAddress } from '#/api/generated/model'
import { AddressForm } from '#/features/address/components/address-form'
import { useUpdateAddressForm } from '#/features/address/hooks/use-update-address-form'

export function UpdateAddressForm({ address }: { address: StoreCustomerAddress }) {
  const { t } = useLingui()
  const { handleSuccess } = useRouteModal()
  const { form } = useUpdateAddressForm(address, { onSuccess: () => handleSuccess() })

  return <AddressForm form={form} title={t`Edit address`} />
}
