import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, toast } from '@proteus/ui'
import { useNavigate } from '@tanstack/react-router'
import { EllipsisIcon } from 'lucide-react'
import type { AdminRole } from '#/api/generated/model'
import { useDeleteRole } from '#/features/access-control/api/roles'

export function RoleRowActions({ role }: { role: AdminRole }) {
  const navigate = useNavigate()
  const deleteMutation = useDeleteRole({
    onSuccess: () => {
      toast.add({ type: 'success', title: `Role "${role.name}" deleted` })
    },
  })

  const canDelete = !role.isSuperAdmin && !role.protected

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => navigate({ to: `/settings/roles/${role.id}` })}>Edit</DropdownMenuItem>
        {canDelete && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              deleteMutation.mutate(role.id)
            }}
          >
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
