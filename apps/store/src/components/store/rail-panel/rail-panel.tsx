import { cn } from '@proteus/ui-core'
import { ChevronDownIcon } from 'lucide-react'
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
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover/popover'

/**
 * The label and chevron take their colour from the trigger's hover, so each carries the fade the
 * trigger's own text has (`button`'s colour transition in `styles.css`).
 */
const HOVER_FADE = 'transition-[color] ease-[ease]'

/**
 * A Category with children, or an entry with sections, opens a panel rather than navigating, its
 * "Shop all" first and set apart, since the trigger no longer goes there. Sections lay out as one
 * titled column each, side by side. Controlled so that following a link closes it — a navigation
 * leaves a popover open otherwise.
 *
 * Each link's text is its own children, so the link carries its label's type.
 */
export function RailPanel({ group }: { group: MenuGroup }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const hasSections = group.sections.length > 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn(navTrigger(), 'cursor-pointer')}>
        <span className={cn(navLabel(), HOVER_FADE)}>{group.label}</span>
        <ChevronDownIcon className={cn(navChevron(), navGlyph(), HOVER_FADE)} />
      </PopoverTrigger>
      {/* The panel is the popup itself, so its minimum width includes the popup's border: the set
          draws the panel inside the border, 2px wider than the store runs. Sections are not drawn
          yet: their panel sizes to its columns rather than the rail's minimum. */}
      <PopoverContent align="start" className={cn(railPanel(), hasSections && 'w-auto min-w-0 max-w-4xl')}>
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
        {hasSections && (
          <div className="flex gap-6 py-2">
            {group.sections.map((section) => (
              <section key={section.key} className="min-w-40">
                <h3 className="m-0 px-4 py-2 font-medium text-ink-muted text-xs uppercase">{section.title}</h3>
                <ul className="m-0 list-none p-0">
                  {section.links.map((link) => (
                    <li key={link.key}>
                      <MenuLink
                        destination={link}
                        onClick={close}
                        className={cn(railPanelLink(), railPanelLinkLabel())}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
