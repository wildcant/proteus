import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cn } from '@proteus/ui-core'
import { createLink } from '@tanstack/react-router'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { button, buttonLabel } from '#/components/ui/button/button.variants'

type ButtonStyleProps = VariantProps<typeof button> & { className?: string }

const BEHAVIOUR =
  "shrink-0 select-none whitespace-nowrap bg-clip-padding outline-none transition-all active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0"

/**
 * The label layer's type and colour go on the root, where the caller's text inherits them: a button's
 * children are its own (text, a glyph, or both with the caller's `gap-*`), so wrapping them in a layer
 * would split that gap. On the root, the label's `hidden` for an icon button would hide the button, and an
 * icon button has no label, so it reads the label at the default size; the icon layer's 16 px glyph is the
 * `[&_svg]` sizing above.
 */
function buttonStyles({ variant, size, className }: ButtonStyleProps) {
  const labelSize = size === 'icon' ? 'default' : size
  return cn(button({ variant, size }), buttonLabel({ variant, size: labelSize }), BEHAVIOUR, className)
}

export type ButtonProps = Omit<ButtonPrimitive.Props, 'className'> & ButtonStyleProps

export function Button({ variant = 'default', size = 'default', className, ...props }: ButtonProps) {
  return <ButtonPrimitive data-slot="button" className={buttonStyles({ variant, size, className })} {...props} />
}

/**
 * A link that looks like a button. `createLink` is called on this leaf rather than wrapping
 * `Button`, because wrapping a `LinkComponent` means restating its router generics to keep `to` typed.
 */
export const ButtonLink = createLink(function ButtonAnchor({
  variant = 'default',
  size = 'default',
  className,
  ...props
}: ComponentProps<'a'> & ButtonStyleProps) {
  return <a data-slot="button" className={buttonStyles({ variant, size, className })} {...props} />
})
