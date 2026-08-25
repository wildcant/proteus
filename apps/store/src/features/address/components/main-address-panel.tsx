import { Panel } from '#/components/panel'
import { useSuspenseAddresses } from '#/features/address/api/addresses'
import { AddressLines } from '#/features/address/components/address-lines'

/**
 * The default address, surfaced above the add button in the left column.
 *
 * It renders nothing until one is set: a panel headed "Main address" over an empty block would
 * read as a bug rather than as an invitation, and the list's radios are how one gets chosen.
 */
export function MainAddressPanel() {
  const { addresses } = useSuspenseAddresses()
  const main = addresses.find((address) => address.isDefaultShipping || address.isDefaultBilling)

  if (!main) return null

  return (
    <Panel title="Main address" className="lg:p-6">
      <div className="mt-4">
        <AddressLines address={main} />
      </div>
    </Panel>
  )
}
