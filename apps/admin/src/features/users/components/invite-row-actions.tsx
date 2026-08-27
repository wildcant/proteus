import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
  usePrompt,
} from '@proteus/ui'
import { EllipsisIcon, LinkIcon, RefreshCwIcon, TrashIcon } from 'lucide-react'
import type { AdminInvite } from '#/api/generated/model'
import { useDeleteInvite, useResendInvite } from '#/features/users/api/invites'

type InviteRowActionsProps = {
  invite: AdminInvite
}

export function InviteRowActions({ invite }: InviteRowActionsProps) {
  const { mutate: resend } = useResendInvite(invite.id)
  const { mutate: remove } = useDeleteInvite(invite.id)
  const prompt = usePrompt()

  // Uses navigator.clipboard which requires a secure context (HTTPS) and page focus.
  // Sufficient for admin apps served over HTTPS or localhost.
  const handleCopyInviteLink = () => {
    const link = `${window.location.origin}/invite?token=${invite.token}`
    navigator.clipboard.writeText(link)
    toast.add({ type: 'success', title: 'Invite link copied to clipboard' })
  }

  const handleDelete = async () => {
    const confirmed = await prompt({
      title: 'Delete invite',
      description: `Are you sure you want to delete the invite for ${invite.email}?`,
      confirmText: 'Delete',
      variant: 'danger',
    })

    if (confirmed) {
      remove()
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!invite.accepted && (
          <>
            <DropdownMenuItem onClick={() => resend()}>
              <RefreshCwIcon />
              Resend invite
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyInviteLink}>
              <LinkIcon />
              Copy invite link
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem variant="destructive" onClick={handleDelete}>
          <TrashIcon />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
