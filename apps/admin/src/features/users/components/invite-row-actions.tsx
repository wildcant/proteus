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
import { EllipsisIcon, LinkIcon, RefreshCwIcon, TrashIcon } from 'lucide-react'
import type { AdminInvite } from '#/api/generated/model'
import { useDeleteInvite, useResendInvite } from '#/features/users/api/invites'
import { useUiCopy } from '#/hooks/use-ui-copy'

type InviteRowActionsProps = {
  invite: AdminInvite
}

export function InviteRowActions({ invite }: InviteRowActionsProps) {
  const { mutate: resend } = useResendInvite(invite.id)
  const { mutate: remove } = useDeleteInvite(invite.id)
  const prompt = usePrompt()
  const { t } = useLingui()
  const { cancel } = useUiCopy()

  // Uses navigator.clipboard which requires a secure context (HTTPS) and page focus.
  // Sufficient for admin apps served over HTTPS or localhost.
  const handleCopyInviteLink = () => {
    const link = `${window.location.origin}/invite?token=${invite.token}`
    navigator.clipboard.writeText(link)
    toast.add({ type: 'success', title: t`Invite link copied to clipboard` })
  }

  const handleDelete = async () => {
    const email = invite.email
    const confirmed = await prompt({
      title: t`Delete invite`,
      description: t`Are you sure you want to delete the invite for ${email}?`,
      confirmText: t`Delete`,
      cancelText: cancel,
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
              <Trans>Resend invite</Trans>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyInviteLink}>
              <LinkIcon />
              <Trans>Copy invite link</Trans>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem variant="destructive" onClick={handleDelete}>
          <TrashIcon />
          <Trans>Delete</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
