import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { CommandBar, CommandBarCommand, CommandBarSeparator, CommandBarValue, usePrompt } from '@proteus/ui'
import { useState } from 'react'
import { DataTable } from '#/components/data-table/data-table'
import { useRemoveRegionCountries } from '#/features/regions/api/countries'
import { useRegionCountryTable } from '#/features/regions/hooks/use-region-country-table'
import { useUiCopy } from '#/hooks/use-ui-copy'

/**
 * The countries this region sells to, with the locale each of them reads in.
 *
 * The checkbox column and the row menu do the same thing to different numbers of rows, so both go
 * through one mutation. Selection is held here rather than in the table because the table only ever
 * holds one page and a merchant clearing a continent will page through several.
 */
export function RegionCountriesCard({ regionId }: { regionId: string }) {
  const { t } = useLingui()
  const { cancel } = useUiCopy()
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const { mutate: remove } = useRemoveRegionCountries(regionId, { onSuccess: () => setSelectedCodes([]) })
  const prompt = usePrompt()

  const countries = useRegionCountryTable(regionId, selectedCodes, setSelectedCodes)

  const removeSelected = async () => {
    const count = selectedCodes.length
    const confirmed = await prompt({
      title: t`Remove countries`,
      description: t`${plural(count, {
        one: '# country will stop being sold to, and their storefronts will no longer resolve.',
        other: '# countries will stop being sold to, and their storefronts will no longer resolve.',
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
        use={countries}
        heading={t`Countries`}
        actions={[{ label: t`Add`, to: `/settings/regions/${regionId}/countries` }]}
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
