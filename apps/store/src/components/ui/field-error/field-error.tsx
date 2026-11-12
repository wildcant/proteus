import { cn } from '@proteus/ui-core'
import { type ComponentProps, useMemo } from 'react'
import { fieldError, fieldErrorMessage } from '#/components/ui/field-error/field-error.variants'

type FieldErrorProps = ComponentProps<'div'> & {
  errors?: Array<{ message?: string } | undefined>
}

/** Renders nothing without a message; several distinct messages become a list, which the set doesn't draw. */
export function FieldError({ className, children, errors, ...props }: FieldErrorProps) {
  const content = useMemo(() => {
    if (children) return children
    if (!errors?.length) return null

    const uniqueErrors = [...new Map(errors.map((error) => [error?.message, error])).values()]
    if (uniqueErrors.length === 1) return uniqueErrors[0]?.message

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {uniqueErrors.map((error) => !!error?.message && <li key={error.message}>{error.message}</li>)}
      </ul>
    )
  }, [children, errors])

  if (!content) return null

  return (
    <div role="alert" data-slot="field-error" className={cn(fieldError(), fieldErrorMessage(), className)} {...props}>
      {content}
    </div>
  )
}
