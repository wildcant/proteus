import { Button as BaseButton, cn } from '@proteus/ui'
import type { ComponentProps } from 'react'

export type ButtonProps = ComponentProps<typeof BaseButton>

/** Colour and treatment. Applied whatever the size, so icon buttons stay on-brand too. */
const variantStyles: Record<string, string> = {
  default: '',
  outline: 'border-ink bg-transparent hover:bg-ink/5',
  ghost: '',
  link: 'font-bold underline underline-offset-4',
}

/** Height and padding. Skipped when a `size` is passed, since that is what `size` is for. */
const sizeStyles: Record<string, string> = {
  default: 'h-13 px-6',
  outline: 'h-13 px-6',
  ghost: 'h-13 px-6',
  link: 'h-auto px-0',
}

export function Button({ variant = 'default', size, className, ...props }: ButtonProps) {
  const key = variant ?? 'default'

  return (
    <BaseButton
      variant={variant}
      size={size}
      // Corners come from --radius: 0 in styles.css, and the ink/surface pairing from
      // --primary, so neither is restated here. Labels stay title case: uppercase is
      // reserved for the display type roles, which is what keeps the two voices apart.
      className={cn('font-medium text-sm', variantStyles[key], !size && sizeStyles[key], className)}
      {...props}
    />
  )
}
