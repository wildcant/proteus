import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@proteus/ui'
import { useNavigate } from '@tanstack/react-router'
import { EllipsisIcon } from 'lucide-react'
import type { AdminRegion } from '#/api/generated/model'

/**
 * Edit, and nothing else.
 *
 * There is deliberately no Delete: a region owns live carts, orders and prices, and nothing in
 * this feature makes removing one safe. The API has no delete route either.
 */
export function RegionRowActions({ region }: { region: AdminRegion }) {
  const navigate = useNavigate()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => navigate({ to: `/settings/regions/${region.id}/edit` })}>
          Edit
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
