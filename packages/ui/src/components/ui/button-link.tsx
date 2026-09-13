import { createLink } from '@tanstack/react-router'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { buttonVariants } from '#/components/ui/button.tsx'
import { cn } from '#/lib/utils.ts'

/**
 * A link wearing the button's look, for a control that navigates.
 *
 * The classes go on the `<a>` rather than the anchor going through `Button`: base-ui's Button is
 * for buttons, and "links have their own semantics and should not be rendered as buttons through
 * the render prop" — rendering one through it stamps `role="button"` over the link role, which
 * costs the link rotor, open-in-new-tab and everything else an anchor announces.
 *
 * `createLink` keeps `to`, `params` and `search` typed: its router generic defaults to
 * `RegisteredRouter`, resolved where the component is rendered, so each app types against its own
 * route tree.
 */
export const ButtonLink = createLink(function ButtonAnchor({
  variant,
  size,
  className,
  ...props
}: ComponentProps<'a'> & VariantProps<typeof buttonVariants>) {
  return <a data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />
})
