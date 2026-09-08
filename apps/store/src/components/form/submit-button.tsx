import { useFormContext } from '#/lib/form-context'
import { Button, type ButtonProps } from '../button'

type SubmitButtonProps = Pick<ButtonProps, 'children' | 'className' | 'size'>

/**
 * Submit, disabled only while the write it started is in flight.
 *
 * It takes no flag of its own. Every form hook awaits its mutation inside `onSubmit` — the
 * contract in ast-grep/rules/frontend/features/hooks/__docs__/form-hooks.md — so `isSubmitting` is true for exactly as long as the request
 * is in the air. A second source of truth here would only be a second thing to forget.
 *
 * It takes no `disabled` either: a button greyed out because the form is incomplete is a button
 * that cannot say which field is missing. Let the submit run and let the validator name it.
 */
export function SubmitButton({ children, className, size }: SubmitButtonProps) {
  const form = useFormContext()
  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <Button type="submit" size={size} disabled={isSubmitting} className={className}>
          {children}
        </Button>
      )}
    </form.Subscribe>
  )
}
