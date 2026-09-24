import { Trans, useLingui } from '@lingui/react/macro'
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
import { useUiCopy } from '#/hooks/use-ui-copy'

export function RoleRowActions({ role }: { role: AdminRole }) {
  const navigate = useNavigate()
  const prompt = usePrompt()
  const { t } = useLingui()
  const { cancel } = useUiCopy()
  const name = role.name
  const deleteMutation = useDeleteRole({
    onSuccess: () => {
      toast.add({ type: 'success', title: t`Role "${name}" deleted` })
    },
  })

  const canDelete = !role.isSuperAdmin && !role.protected

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const confirmed = await prompt({
      title: t`Delete role`,
      description: t`Are you sure you want to delete "${name}"? This action cannot be undone.`,
      confirmText: t`Delete`,
      cancelText: cancel,
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
        <DropdownMenuItem onClick={() => navigate({ to: `/settings/roles/${role.id}` })}>
          <Trans>Edit</Trans>
        </DropdownMenuItem>
        {!!canDelete && (
          <DropdownMenuItem onClick={handleDelete}>
            <Trans>Delete</Trans>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
