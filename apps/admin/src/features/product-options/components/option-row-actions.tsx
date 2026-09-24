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
import type { AdminProductOption } from '#/api/generated/model'
import { useDeleteProductOption } from '#/features/product-options/api/product-options'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function OptionRowActions({ option }: { option: AdminProductOption }) {
  const { mutate: remove } = useDeleteProductOption(option.id)
  const navigate = useNavigate()
  const prompt = usePrompt()
  const { t } = useLingui()
  const { cancel } = useUiCopy()
  const title = option.title

  const handleDelete = async () => {
    const confirmed = await prompt({
      title: t`Delete option`,
      description: t`Are you sure you want to delete the option "${title}"?`,
      confirmText: t`Delete`,
      cancelText: cancel,
      variant: 'danger',
    })

    if (confirmed) {
      remove(undefined, {
        onSuccess: () => toast.add({ type: 'success', title: t`Option "${title}" deleted` }),
      })
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => navigate({ to: `/product-options/${option.id}/edit` })}>
          <Trans>Edit</Trans>
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={handleDelete}>
          <Trans>Delete</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
