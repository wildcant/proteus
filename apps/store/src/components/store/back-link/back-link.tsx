import { cn } from '@proteus/ui-core'
import type { LinkProps } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import {
  backLink,
  backLinkChevron,
  backLinkGlyph,
  backLinkLabel,
} from '#/components/store/back-link/back-link.variants'
import { ButtonLink } from '#/components/ui/button/button'
import { Icon } from '#/components/ui/icon/icon'

type BackLinkProps = Pick<LinkProps, 'to'> & {
  children: ReactNode
  className?: string
}

/**
 * The muted 'Back to account' link above an account sub-page's title.
 *
 * On the link Button rather than a bare anchor: the Button carries the transparent border its
 * focus ring turns ink, and that border is what the drawing leaves out (it draws the link 2px
 * shorter than the page renders).
 */
export function BackLink({ to, className, children }: BackLinkProps) {
  return (
    // `block` / `inline-flex`: the link sits on a text line, as the store renders it — the line's
    // strut leaves 1.5px under it that the caller's drawn flex column drops.
    <div className={cn(className, 'block')}>
      <ButtonLink variant="link" to={to} className={cn(backLink(), 'inline-flex')}>
        <Icon name="chevron-left" aria-hidden="true" className={cn(backLinkChevron(), backLinkGlyph())} />
        <span className={backLinkLabel()}>{children}</span>
      </ButtonLink>
    </div>
  )
}
