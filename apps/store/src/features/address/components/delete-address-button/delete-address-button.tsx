import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import type { StoreCustomerAddress } from '#/api/generated/model'
import { Button } from '#/components/ui/button/button'
import { Icon } from '#/components/ui/icon/icon'
import { usePrompt } from '#/components/ui/prompt/prompt'
import { useDeleteAddress } from '#/entities/address/api/addresses'
import {
  deleteAddressButton,
  deleteAddressButtonIcon,
  deleteAddressButtonLabel,
  deleteAddressButtonTrash,
} from '#/features/address/components/delete-address-button/delete-address-button.variants'

/**
 * Delete goes through a confirmation: a one-tap destructive action sitting next to an edit link
 * on a phone is a mis-tap waiting to happen.
 *
 * On the link Button for its transparent border and focus ring, which the drawing leaves out
 * (it draws the link 2px shorter than the page renders).
 */
export function DeleteAddressButton({ address, className }: { address: StoreCustomerAddress; className?: string }) {
  const { t } = useLingui()
  const prompt = usePrompt()
  const deleteAddress = useDeleteAddress()
  const label = address.addressName || address.address1 || t`this address`

  const confirmAndDelete = async () => {
    const confirmed = await prompt({
      title: t`Remove this address?`,
      description: t`${label} will be removed from your address book. This cannot be undone.`,
      confirmText: t`Remove`,
    })

    if (!confirmed) return

    deleteAddress.mutate(address.id)
  }

  return (
    <Button
      variant="link"
      className={cn(deleteAddressButton(), className)}
      onClick={confirmAndDelete}
      disabled={deleteAddress.isPending}
    >
      <Icon name="trash-2" aria-hidden="true" className={cn(deleteAddressButtonIcon(), deleteAddressButtonTrash())} />
      <span className={deleteAddressButtonLabel()}>
        <Trans>Delete</Trans>
      </span>
    </Button>
  )
}
