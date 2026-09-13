import { Button as BaseButton, buttonVariants, cn } from '@proteus/ui'
import { createLink } from '@tanstack/react-router'
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

/**
 * Corners come from --radius: 0 in styles.css, and the ink/surface pairing from --primary, so
 * neither is restated here. Labels stay title case: uppercase is reserved for the display type
 * roles, which is what keeps the two voices apart.
 */
function storeButtonStyles({ variant = 'default', size, className }: ButtonStyleProps) {
  const key = variant ?? 'default'

  return cn('font-medium text-sm', variantStyles[key], !size && sizeStyles[key], className)
}

type ButtonStyleProps = Pick<ButtonProps, 'variant' | 'size' | 'className'>

export function Button({ variant = 'default', size, className, ...props }: ButtonProps) {
  return (
    <BaseButton variant={variant} size={size} className={storeButtonStyles({ variant, size, className })} {...props} />
  )
}

/**
 * `@proteus/ui`'s `ButtonLink` carrying the storefront's treatment, the same way `Button` above
 * wraps the shared button — the brand layer is what cannot be shared, since admin must not get it.
 * `createLink` is called on this leaf rather than wrapping the shared component, because wrapping
 * a `LinkComponent` means restating its router generics to keep `to` typed.
 */
export const ButtonLink = createLink(function StoreButtonAnchor({
  variant = 'default',
  size,
  className,
  ...props
}: ComponentProps<'a'> & ButtonStyleProps) {
  return (
    <a
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), storeButtonStyles({ variant, size, className }))}
      {...props}
    />
  )
})
