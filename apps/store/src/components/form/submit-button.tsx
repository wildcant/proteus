import { useFormContext } from '#/lib/form-context'
import { Button, type ButtonProps } from '../button'

type SubmitButtonProps = Pick<ButtonProps, 'children' | 'disabled' | 'className'>
export function SubmitButton({ children, disabled, className }: SubmitButtonProps) {
  const form = useFormContext()
  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <Button type="submit" disabled={isSubmitting || disabled} className={className}>
          {children}
        </Button>
      )}
    </form.Subscribe>
  )
}
