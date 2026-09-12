import { CommandBar, CommandBarCommand, CommandBarSeparator, CommandBarValue, usePrompt } from '@proteus/ui'
import { useState } from 'react'
import { DataTable } from '#/components/data-table/data-table'
import { useRemoveRegionCountries } from '#/features/regions/api/countries'
import { useRegionCountryTable } from '#/features/regions/hooks/use-region-country-table'

/**
 * The countries this region sells to, with the locale each of them reads in.
 *
 * The checkbox column and the row menu do the same thing to different numbers of rows, so both go
 * through one mutation. Selection is held here rather than in the table because the table only ever
 * holds one page and a merchant clearing a continent will page through several.
 */
export function RegionCountriesCard({ regionId }: { regionId: string }) {
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const { mutate: remove } = useRemoveRegionCountries(regionId, { onSuccess: () => setSelectedCodes([]) })
  const prompt = usePrompt()

  const countries = useRegionCountryTable(regionId, selectedCodes, setSelectedCodes)

  const removeSelected = async () => {
    const confirmed = await prompt({
      title: 'Remove countries',
      description: `${selectedCodes.length} ${selectedCodes.length === 1 ? 'country' : 'countries'} will stop being sold to, and their storefronts will no longer resolve.`,
      confirmText: 'Remove',
      variant: 'danger',
    })

    if (confirmed) remove(selectedCodes)
  }

  return (
    <>
      <DataTable
        use={countries}
        heading="Countries"
        actions={[{ label: 'Add', to: `/settings/regions/${regionId}/countries` }]}
      />
      <CommandBar open={selectedCodes.length > 0}>
        <CommandBarValue>{selectedCodes.length} selected</CommandBarValue>
        <CommandBarSeparator />
        <CommandBarCommand action={removeSelected} label="Remove" shortcut="r" />
      </CommandBar>
    </>
  )
}
