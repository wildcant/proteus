import { CommandBar, CommandBarCommand, CommandBarSeparator, CommandBarValue, usePrompt } from '@proteus/ui'
import { useState } from 'react'
import { DataTable } from '#/components/data-table'
import { useRemoveStoreCurrencies } from '#/features/store/api/store'
import { useStoreCurrencyTable } from '#/features/store/hooks/use-store-currency-table'

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
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const { mutate: remove } = useRemoveStoreCurrencies({ onSuccess: () => setSelectedCodes([]) })
  const prompt = usePrompt()

  const currencies = useStoreCurrencyTable(selectedCodes, setSelectedCodes)

  const removeSelected = async () => {
    const confirmed = await prompt({
      title: 'Remove currencies',
      description: `Products will no longer carry a price in ${selectedCodes.length} ${selectedCodes.length === 1 ? 'currency' : 'currencies'}, and no region will be able to settle in ${selectedCodes.length === 1 ? 'it' : 'them'}.`,
      confirmText: 'Remove',
      variant: 'danger',
    })

    if (confirmed) remove(selectedCodes)
  }

  return (
    <>
      <DataTable use={currencies} heading="Currencies" actions={[{ label: 'Add', to: '/settings/store/currencies' }]} />
      <CommandBar open={selectedCodes.length > 0}>
        <CommandBarValue>{selectedCodes.length} selected</CommandBarValue>
        <CommandBarSeparator />
        <CommandBarCommand action={removeSelected} label="Remove" shortcut="r" />
      </CommandBar>
    </>
  )
}
