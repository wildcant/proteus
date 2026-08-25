import type { ReactNode } from 'react'

type FormProps = {
  onSubmit: () => void
  children: ReactNode
  className?: string
}

/**
 * Wrapper for every form in the store.
 *
 * `noValidate` is the reason this exists. Inputs carry type="email" and type="tel" to get
 * the right mobile keyboard, but that also opts them into the browser's own constraint
 * validation, which interrupts submit with a native bubble ("Please include an '@' in the
 * email address") instead of the field error our Zod schema produces. Switching it off
 * leaves exactly one validator and one error style.
 *
 * It also owns the preventDefault every form was repeating.
 *
 * onSubmit is called with no arguments, which is what lets callers pass a bare
 * `form.handleSubmit`. On a raw <form> that same reference would receive the SubmitEvent
 * as TanStack's `submitMeta` argument.
 */
export function Form({ onSubmit, children, className }: FormProps) {
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      className={className}
    >
      {children}
    </form>
  )
}
