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
import { EllipsisIcon } from 'lucide-react'
import type { AdminProductOption, AdminProductOptionValue } from '#/api/generated/model'
import { useUpdateProductOption } from '#/features/product-options/api/product-options'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function ValueRowActions({ option, value }: { option: AdminProductOption; value: AdminProductOptionValue }) {
  const { mutate: update } = useUpdateProductOption(option.id)
  const prompt = usePrompt()
  const { t } = useLingui()
  const { cancel } = useUiCopy()
  const valueName = value.value
  const optionTitle = option.title

  const handleDelete = async () => {
    const confirmed = await prompt({
      title: t`Remove value`,
      description: t`Are you sure you want to remove "${valueName}" from "${optionTitle}"?`,
      confirmText: t`Remove`,
      cancelText: cancel,
      variant: 'danger',
    })

    if (confirmed) {
      const remainingValues = option.values.filter((v) => v.id !== value.id).map((v) => ({ value: v.value }))
      update(
        { values: remainingValues },
        { onSuccess: () => toast.add({ type: 'success', title: t`Value "${valueName}" removed` }) },
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
          <Trans>Delete</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
