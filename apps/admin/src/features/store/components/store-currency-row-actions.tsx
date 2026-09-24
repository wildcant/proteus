import { Trans, useLingui } from '@lingui/react/macro'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  usePrompt,
} from '@proteus/ui'
import { getCurrencyName } from '@proteus/utils'
import { EllipsisIcon, StarIcon, TrashIcon } from 'lucide-react'
import type { AdminStoreCurrency } from '#/api/generated/model'
import { useRemoveStoreCurrencies, useSetDefaultStoreCurrency } from '#/features/store/api/store'
import { storeCurrencyActions } from '#/features/store/utils/store-currencies'
import { useUiCopy } from '#/hooks/use-ui-copy'
import { activeLocale } from '#/lib/i18n/locale'

/**
 * Make this currency the default, or stop selling in it.
 *
 * The menu is empty for the default currency — it cannot be nominated again, and it cannot be
 * removed — so the trigger is withheld rather than opening onto nothing.
 *
 * Removal is confirmed rather than immediate: it takes a price column off every product, and the
 * prices themselves stay behind in a currency nothing reads.
 */
export function StoreCurrencyRowActions({ currency }: { currency: AdminStoreCurrency }) {
  const { t } = useLingui()
  const { cancel } = useUiCopy()
  const { mutate: makeDefault } = useSetDefaultStoreCurrency()
  const { mutate: remove } = useRemoveStoreCurrencies()
  const prompt = usePrompt()

  const { canMakeDefault, canRemove } = storeCurrencyActions(currency)
  if (!canMakeDefault && !canRemove) return null

  const handleRemove = async () => {
    const currencyName = getCurrencyName(currency.currencyCode, activeLocale())
    const confirmed = await prompt({
      title: t`Remove currency`,
      description: t`Products will no longer carry a ${currencyName} price, and no region will be able to settle in it.`,
      confirmText: t`Remove`,
      cancelText: cancel,
      variant: 'danger',
    })

    if (confirmed) remove([currency.currencyCode])
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canMakeDefault ? (
          <DropdownMenuItem onClick={() => makeDefault(currency.currencyCode)}>
            <StarIcon />
            <Trans>Make default</Trans>
          </DropdownMenuItem>
        ) : null}
        {canRemove ? (
          <DropdownMenuItem variant="destructive" onClick={handleRemove}>
            <TrashIcon />
            <Trans>Remove</Trans>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
