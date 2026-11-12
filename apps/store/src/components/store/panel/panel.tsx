import { useRender } from '@base-ui/react/use-render'
import { cn } from '@proteus/ui-core'
import { ChevronRightIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  panel,
  panelBody,
  panelChevron,
  panelDescription,
  panelDescriptionText,
  panelHeader,
  panelTitle,
} from '#/components/store/panel/panel.variants'

type PanelProps = useRender.ComponentProps<'div'> & {
  title: string
  /** Muted sub-line under the heading. Omitted when the panel's body already says what it is. */
  description?: ReactNode
  /** Set on a panel that navigates. The whole block is the hit target, so the mark is the only
   *  thing that says so. */
  chevron?: boolean
}

/**
 * A square filled block with an uppercase heading — the same filled-utility treatment as the
 * header's search control, at page scale.
 *
 * Polymorphic through base-ui's `useRender` rather than a `to` prop, so a panel that navigates
 * is `render={<Link to="…" />}` and the whole block becomes the hit target.
 *
 * Lives here rather than in `features/account` because the address book uses it too, and a
 * presentational block with no feature logic in it has no business making one feature depend on
 * another.
 */
export function Panel({ render, title, description, chevron, className, children, ...props }: PanelProps) {
  return useRender({
    render,
    defaultTagName: 'div',
    props: {
      ...props,
      className: cn(panel(), className),
      children: (
        <>
          <div className={panelHeader()}>
            <h2 className={panelTitle()}>{title}</h2>
            {chevron ? <ChevronRightIcon className={cn(panelChevron(), 'shrink-0')} /> : null}
          </div>
          {description ? (
            <div className={panelDescription()}>
              <p className={panelDescriptionText()}>{description}</p>
            </div>
          ) : null}
          {children == null ? null : <div className={panelBody()}>{children}</div>}
        </>
      ),
    },
  })
}
