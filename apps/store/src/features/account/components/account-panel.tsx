import { cn, useRender } from '@proteus/ui'
import type { ReactNode } from 'react'

type AccountPanelProps = useRender.ComponentProps<'div'> & {
  title: string
  /** Muted sub-line under the heading. Omitted when the panel's body already says what it is. */
  description?: ReactNode
}

/**
 * A square filled block with an uppercase heading — the same filled-utility treatment as the
 * header's search control, at page scale.
 *
 * Polymorphic through base-ui's `useRender` rather than a `to` prop, so a panel that navigates
 * is `render={<Link to="…" />}` and the whole block becomes the hit target. None of the panels
 * the storefront can back today navigate: Address Book waits on `/store/customers/me/addresses`
 * (06-address-book.md) and Returns on a returns concept in the order module.
 */
export function AccountPanel({ render, title, description, className, children, ...props }: AccountPanelProps) {
  return useRender({
    render,
    defaultTagName: 'div',
    props: {
      ...props,
      className: cn('flex flex-col bg-surface-subtle p-6 lg:p-10', className),
      children: (
        <>
          <h2 className="type-heading text-ink">{title}</h2>
          {description ? <p className="mt-2 text-ink-muted text-sm">{description}</p> : null}
          {children}
        </>
      ),
    },
  })
}
