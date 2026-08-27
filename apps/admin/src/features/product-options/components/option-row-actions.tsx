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

export function OptionRowActions({ option }: { option: AdminProductOption }) {
  const { mutate: remove } = useDeleteProductOption(option.id)
  const navigate = useNavigate()
  const prompt = usePrompt()

  const handleDelete = async () => {
    const confirmed = await prompt({
      title: 'Delete option',
      description: `Are you sure you want to delete the option "${option.title}"?`,
      confirmText: 'Delete',
      variant: 'danger',
    })

    if (confirmed) {
      remove(undefined, {
        onSuccess: () => toast.add({ type: 'success', title: `Option "${option.title}" deleted` }),
      })
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => navigate({ to: `/product-options/${option.id}/edit` })}>Edit</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={handleDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
