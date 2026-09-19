import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
  usePrompt,
} from '@proteus/ui'
import { useNavigate } from '@tanstack/react-router'
import { EllipsisIcon } from 'lucide-react'
import type { AdminRole } from '#/api/generated/model'
import { useDeleteRole } from '#/features/access-control/api/roles'

export function RoleRowActions({ role }: { role: AdminRole }) {
  const navigate = useNavigate()
  const prompt = usePrompt()
  const deleteMutation = useDeleteRole({
    onSuccess: () => {
      toast.add({ type: 'success', title: `Role "${role.name}" deleted` })
    },
  })

  const canDelete = !role.isSuperAdmin && !role.protected

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const confirmed = await prompt({
      title: 'Delete role',
      description: `Are you sure you want to delete "${role.name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
    })
    if (confirmed) {
      deleteMutation.mutate(role.id)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => navigate({ to: `/settings/roles/${role.id}` })}>Edit</DropdownMenuItem>
        {canDelete && <DropdownMenuItem onClick={handleDelete}>Delete</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
