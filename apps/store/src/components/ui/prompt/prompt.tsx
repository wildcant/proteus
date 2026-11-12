import { createPromptHook, type PromptRendererProps } from '@proteus/ui-core'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog/alert-dialog'

/** Every prompt the store asks is destructive, so the action always wears the set's danger look. */
type PromptProps = {
  title: string
  description: string
  cancelText?: string
  confirmText?: string
}

function RenderPrompt({
  open,
  title,
  description,
  cancelText = 'Cancel',
  confirmText = 'Confirm',
  onConfirm,
  onCancel,
}: PromptRendererProps<PromptProps>) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onCancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmText}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export const usePrompt = createPromptHook<PromptProps>(RenderPrompt)
