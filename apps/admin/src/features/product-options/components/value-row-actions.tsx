import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
  usePrompt,
} from '@proteus/ui'
import { EllipsisIcon } from 'lucide-react'
import type { AdminProductOption, AdminProductOptionValue } from '#/api/generated/model'
import { useUpdateProductOption } from '#/features/product-options/api/product-options'

export function ValueRowActions({ option, value }: { option: AdminProductOption; value: AdminProductOptionValue }) {
  const { mutate: update } = useUpdateProductOption(option.id)
  const prompt = usePrompt()

  const handleDelete = async () => {
    const confirmed = await prompt({
      title: 'Remove value',
      description: `Are you sure you want to remove "${value.value}" from "${option.title}"?`,
      confirmText: 'Remove',
      variant: 'danger',
    })

    if (confirmed) {
      const remainingValues = option.values.filter((v) => v.id !== value.id).map((v) => ({ value: v.value }))
      update(
        { values: remainingValues },
        { onSuccess: () => toast.add({ type: 'success', title: `Value "${value.value}" removed` }) },
      )
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" />}>
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem variant="destructive" onClick={handleDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
