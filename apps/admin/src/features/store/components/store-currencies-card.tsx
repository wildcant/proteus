import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { CommandBar, CommandBarCommand, CommandBarSeparator, CommandBarValue, usePrompt } from '@proteus/ui'
import { useState } from 'react'
import { DataTable } from '#/components/data-table/data-table'
import { useRemoveStoreCurrencies } from '#/features/store/api/store'
import { useStoreCurrencyTable } from '#/features/store/hooks/use-store-currency-table'
import { useUiCopy } from '#/hooks/use-ui-copy'

/**
 * The currencies the store sells in, and the card that adds and removes them.
 *
 * The checkbox column and the row menu do the same thing to different numbers of rows, so both go
 * through one mutation. A selection that includes the default currency, or one a region settles
 * in, is refused per currency by the API rather than filtered out here: the rest of the selection
 * still goes, and the refusal names which currency and why — which is more than a greyed-out
 * checkbox could have said.
 */
export function StoreCurrenciesCard() {
  const { t } = useLingui()
  const { cancel } = useUiCopy()
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const { mutate: remove } = useRemoveStoreCurrencies({ onSuccess: () => setSelectedCodes([]) })
  const prompt = usePrompt()

  const currencies = useStoreCurrencyTable(selectedCodes, setSelectedCodes)

  const removeSelected = async () => {
    const count = selectedCodes.length
    const confirmed = await prompt({
      title: t`Remove currencies`,
      description: t`${plural(count, {
        one: 'Products will no longer carry a price in # currency, and no region will be able to settle in it.',
        other: 'Products will no longer carry a price in # currencies, and no region will be able to settle in them.',
      })}`,
      confirmText: t`Remove`,
      cancelText: cancel,
      variant: 'danger',
    })

    if (confirmed) remove(selectedCodes)
  }

  const selectedCount = selectedCodes.length

  return (
    <>
      <DataTable
        use={currencies}
        heading={t`Currencies`}
        actions={[{ label: t`Add`, to: '/settings/store/currencies' }]}
      />
      <CommandBar open={selectedCodes.length > 0}>
        <CommandBarValue>
          <Trans>{selectedCount} selected</Trans>
        </CommandBarValue>
        <CommandBarSeparator />
        <CommandBarCommand action={removeSelected} label={t`Remove`} shortcut="r" />
      </CommandBar>
    </>
  )
}
