import { useLingui } from '@lingui/react/macro'
import { Card, CardAction, CardHeader, CardTitle, usePrompt } from '@proteus/ui'
import { PencilIcon, TrashIcon } from 'lucide-react'
import { ActionMenu } from '#/components/common/action-menu'
import { useUiCopy } from '#/hooks/use-ui-copy'

type ValueEntityCardProps = {
  value: string
  /** The confirmation's copy, naming the entity only ("You are about to delete the tag organic"). */
  deletePrompt: { title: string; description: string }
  /** Runs once the merchant confirms. */
  onDelete: () => void
}

/** A value entity's detail header: its value, with Edit (the `./edit` drawer) and a confirmed Delete. */
export function ValueEntityCard({ value, deletePrompt, onDelete }: ValueEntityCardProps) {
  const { t } = useLingui()
  const { cancel } = useUiCopy()
  const prompt = usePrompt()

  const handleDelete = async () => {
    const confirmed = await prompt({
      ...deletePrompt,
      confirmText: t`Delete`,
      cancelText: cancel,
      variant: 'danger',
    })
    if (!confirmed) return
    onDelete()
  }

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>{value}</CardTitle>
        <CardAction className="flex items-center gap-x-3">
          <ActionMenu
            groups={[
              { actions: [{ label: t`Edit`, to: './edit', icon: <PencilIcon /> }] },
              { actions: [{ label: t`Delete`, onClick: handleDelete, icon: <TrashIcon /> }] },
            ]}
          />
        </CardAction>
      </CardHeader>
    </Card>
  )
}
