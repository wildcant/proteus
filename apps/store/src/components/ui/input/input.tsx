import { Input as InputPrimitive } from '@base-ui/react/input'
import { cn } from '@proteus/ui-core'
import type { ComponentProps } from 'react'
import { input, inputValue } from '#/components/ui/input/input.variants'

/** `invalid` is read from `aria-invalid`, the one place a caller says it, so the look and ARIA can't disagree. */
export function Input({ className, type, ...props }: ComponentProps<'input'>) {
  const invalid = props['aria-invalid'] === true || props['aria-invalid'] === 'true'

  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        input({ invalid }),
        inputValue({ invalid }),
        'min-w-0 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    />
  )
}
