import { Trans, useLingui } from '@lingui/react/macro'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  usePrompt,
} from '@proteus/ui'
import { useNavigate } from '@tanstack/react-router'
import { EllipsisIcon, PencilIcon, TrashIcon } from 'lucide-react'
import type { AdminCountry } from '#/api/generated/model'
import { useRemoveRegionCountries } from '#/features/regions/api/countries'
import { useUiCopy } from '#/hooks/use-ui-copy'

type RegionCountryRowActionsProps = {
  regionId: string
  country: AdminCountry
}

/**
 * Edit the country's locale, or stop selling to it.
 *
 * Removal is confirmed rather than immediate: it closes a market, and the storefront it takes down
 * is one shoppers may be on. Nothing here deletes the country — the ISO list ships whole.
 */
export function RegionCountryRowActions({ regionId, country }: RegionCountryRowActionsProps) {
  const { t } = useLingui()
  const { cancel } = useUiCopy()
  const navigate = useNavigate()
  const { mutate: remove } = useRemoveRegionCountries(regionId)
  const prompt = usePrompt()

  const handleRemove = async () => {
    const name = country.displayName
    const confirmed = await prompt({
      title: t`Remove country`,
      description: t`${name} will stop being sold to, and its storefront will no longer resolve.`,
      confirmText: t`Remove`,
      cancelText: cancel,
      variant: 'danger',
    })

    if (confirmed) remove([country.id])
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => navigate({ to: `/settings/regions/${regionId}/countries/${country.id}` })}>
          <PencilIcon />
          <Trans>Edit locale</Trans>
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={handleRemove}>
          <TrashIcon />
          <Trans>Remove</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
