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
  const navigate = useNavigate()
  const { mutate: remove } = useRemoveRegionCountries(regionId)
  const prompt = usePrompt()

  const handleRemove = async () => {
    const confirmed = await prompt({
      title: 'Remove country',
      description: `${country.displayName} will stop being sold to, and its storefront will no longer resolve.`,
      confirmText: 'Remove',
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
          Edit locale
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={handleRemove}>
          <TrashIcon />
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
