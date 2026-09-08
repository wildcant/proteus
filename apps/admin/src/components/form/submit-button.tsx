import { Button } from '@proteus/ui'
import { useFormContext } from '#/lib/form-context.ts'

type SubmitButtonProps = Pick<React.ComponentProps<typeof Button>, 'children' | 'className' | 'size'> & {
  /**
   * The mutation's own in-flight flag, where the form hook has one.
   *
   * `isSubmitting` alone is not enough here: the hooks call `mutation.mutate()` without awaiting
   * it — the contract in docs/mutation-hooks.md — so the form counts itself submitted the moment
   * the request leaves, while it is still in the air.
   */
  isPending?: boolean
}

/**
 * Submit, disabled only while the request it started is in flight.
 *
 * It takes no `disabled` of its own: a button greyed out because the form is incomplete is a
 * button that cannot say which field is missing. Let the submit run and let the validator name it.
 */
export function SubmitButton({ children, className, size, isPending }: SubmitButtonProps) {
  const form = useFormContext()
  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <Button type="submit" size={size} disabled={isSubmitting || isPending} className={className}>
          {children}
        </Button>
      )}
    </form.Subscribe>
  )
}
