import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Input,
  Label,
} from '@proteus/ui'
import * as React from 'react'

export type PromptProps = {
  title: string
  description: string
  variant?: 'danger' | 'confirmation'
  verificationText?: string
  verificationInstruction?: string
  cancelText?: string
  confirmText?: string
}

type RenderPromptProps = PromptProps & {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function RenderPrompt({
  open,
  variant = 'danger',
  title,
  description,
  verificationText,
  verificationInstruction = 'Please type {val} to confirm:',
  cancelText = 'Cancel',
  confirmText = 'Confirm',
  onConfirm,
  onCancel,
}: RenderPromptProps) {
  const [userInput, setUserInput] = React.useState('')

  const validInput = React.useMemo(() => {
    if (!verificationText) {
      return true
    }
    return userInput === verificationText
  }, [userInput, verificationText])

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!verificationText) {
      return
    }

    if (validInput) {
      onConfirm()
    }
  }

  let instructionParts = verificationInstruction.includes('{val}')
    ? verificationInstruction.split('{val}')
    : ['Please type', 'to confirm:']

  if (instructionParts.length !== 2) {
    instructionParts = ['Please type', 'to confirm:']
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onCancel()
      }}
    >
      <AlertDialogContent>
        <form onSubmit={handleFormSubmit} className="contents">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          {!!verificationText && (
            <div className="flex flex-col gap-y-3 border-t pt-4">
              <Label htmlFor="verificationText" className="text-muted-foreground">
                {instructionParts[0]} <span className="text-foreground font-medium">{verificationText}</span>{' '}
                {instructionParts[1]}
              </Label>
              <Input
                autoFocus
                autoComplete="off"
                id="verificationText"
                placeholder={verificationText}
                onChange={(event) => setUserInput(event.target.value)}
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{cancelText}</AlertDialogCancel>
            <AlertDialogAction
              variant={variant === 'danger' ? 'destructive' : 'default'}
              disabled={!validInput}
              type={verificationText ? 'submit' : 'button'}
              onClick={verificationText ? undefined : onConfirm}
            >
              {confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
