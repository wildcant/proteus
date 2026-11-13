import { cn } from '@proteus/ui-core'
import { useState } from 'react'
import { type MenuGroup, MenuLink } from '#/components/header/menu'
import { navChevron, navGlyph, navLabel, navTrigger } from '#/components/store/nav/nav.variants'
import {
  railPanel,
  railPanelLink,
  railPanelLinkLabel,
  railPanelShopAll,
  railPanelShopAllLabel,
} from '#/components/store/rail-panel/rail-panel.variants'
import { Icon } from '#/components/ui/icon/icon'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover/popover'

/**
 * The label and chevron take their colour from the trigger's hover, so each carries the fade the
 * trigger's own text has (`button`'s colour transition in `styles.css`).
 */
const HOVER_FADE = 'transition-[color] ease-[ease]'

/**
 * A Category with children, or an entry with sections, opens a panel rather than navigating.
 * Children list under "Shop all" first and set apart, since the trigger no longer goes there.
 * Sections lay out as one titled column each, side by side — links, or chips for sizes — each closed
 * by its "View all" and its note, with the entry's footer links below a rule. Controlled so that
 * following a link closes it — a navigation leaves a popover open otherwise.
 *
 * Each link's text is its own children, so the link carries its label's type.
 */
export function RailPanel({ group }: { group: MenuGroup }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const hasSections = group.sections.length > 0
  const columnLinkClassName = 'block py-1.5 text-ink-muted text-sm no-underline hover:text-ink'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn(navTrigger(), 'cursor-pointer')}>
        <span className={cn(navLabel(), HOVER_FADE)}>{group.label}</span>
        <Icon name="chevron-down" className={cn(navChevron(), navGlyph(), HOVER_FADE)} />
      </PopoverTrigger>
      {/* The panel is the popup itself, so the rail's minimum width is the popup's (`size="rail"`).
          A panel of sections sizes to its columns, capped to the viewport so they wrap rather than
          run off the edge. */}
      <PopoverContent
        align="start"
        size={hasSections ? 'default' : 'rail'}
        className={hasSections ? 'w-auto max-w-[min(72rem,calc(100vw-2rem))] px-8 py-6' : railPanel()}
      >
        {!!group.shopAll && (
          <ul className="m-0 list-none p-0">
            {[group.shopAll, ...group.links].map((link, index) => (
              <li key={link.key}>
                <MenuLink
                  destination={link}
                  onClick={close}
                  className={
                    index === 0
                      ? cn(railPanelShopAll(), railPanelShopAllLabel())
                      : cn(railPanelLink(), railPanelLinkLabel())
                  }
                />
              </li>
            ))}
          </ul>
        )}
        {hasSections && (
          <div className="flex flex-wrap gap-x-10 gap-y-8">
            {group.sections.map((section) => (
              <section key={section.key} className="min-w-28 max-w-64">
                <h3 className="m-0 pb-3 font-medium text-ink text-sm">{section.title}</h3>
                {section.display === 'chips' ? (
                  <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                    {section.links.map((link) => (
                      <li key={link.key}>
                        <MenuLink
                          destination={link}
                          onClick={close}
                          className="flex h-9 min-w-12 items-center justify-center rounded-full bg-surface-subtle px-4 text-ink text-sm no-underline hover:bg-line"
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="m-0 list-none p-0">
                    {section.links.map((link) => (
                      <li key={link.key}>
                        <MenuLink destination={link} onClick={close} className={columnLinkClassName} />
                      </li>
                    ))}
                  </ul>
                )}
                {!!section.viewAll && (
                  <MenuLink
                    destination={section.viewAll}
                    onClick={close}
                    className="underline! mt-1.5 block text-ink text-sm underline-offset-4 hover:text-ink-muted"
                  />
                )}
                {!!section.note && <p className="m-0 mt-3 text-ink-muted text-xs">{section.note}</p>}
              </section>
            ))}
          </div>
        )}
        {group.footer.length > 0 && (
          <ul className="m-0 mt-6 flex list-none gap-8 border-line border-t p-0 pt-5">
            {group.footer.map((link) => (
              <li key={link.key}>
                <MenuLink
                  destination={link}
                  onClick={close}
                  className="text-ink text-sm no-underline hover:text-ink-muted"
                />
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
