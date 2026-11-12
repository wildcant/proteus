import { useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Panel } from '#/components/store/panel/panel'
import { useSuspenseAddresses } from '#/entities/address/api/addresses'
import { AddressLines } from '#/entities/address/ui/address-lines/address-lines'
import {
  mainAddressPanel,
  mainAddressPanelAddress,
  mainAddressPanelLines,
  mainAddressPanelPanel,
} from '#/features/address/components/main-address-panel/main-address-panel.variants'

/**
 * The default address, surfaced above the add button in the left column.
 *
 * It renders nothing until one is set: a panel headed "Main address" over an empty block would
 * read as a bug rather than as an invitation, and the list's radios are how one gets chosen.
 */
export function MainAddressPanel({ className }: { className?: string }) {
  const { t } = useLingui()
  const { addresses } = useSuspenseAddresses()
  const main = addresses.find((address) => address.isDefaultShipping || address.isDefaultBilling)

  if (!main) return null

  return (
    <div className={cn(mainAddressPanel(), className)}>
      {/* `lg:p-6`: the nested Panel previews at its mobile padding in the drawing (a nested
          variant swap drops slot content), so its narrower lg padding stays here. */}
      <Panel title={t`Main address`} className={cn(mainAddressPanelPanel(), 'lg:p-6')}>
        <div className={mainAddressPanelLines()}>
          <AddressLines address={main} className={mainAddressPanelAddress()} />
        </div>
      </Panel>
    </div>
  )
}
