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
import { RailPanelSections } from '#/components/store/rail-panel-sections/rail-panel-sections'
import { Icon } from '#/components/ui/icon/icon'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover/popover'

/**
 * The label and chevron take their colour from the trigger's hover, so each carries the fade the
 * trigger's own text has (`button`'s colour transition in `styles.css`).
 */
const HOVER_FADE = 'transition-[color] ease-[ease]'

/**
 * A Category with children, or an entry with sections, opens a panel rather than navigating.
 * Children list under "Shop all" first and set apart, since the trigger no longer goes there; an
 * entry with sections opens `RailPanelSections` instead. Controlled so that following a link closes
 * it — a navigation leaves a popover open otherwise.
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
        <Icon name="chevron-down" className={cn(navChevron(), navGlyph(), HOVER_FADE)} />
      </PopoverTrigger>
      {/* The panel is the popup itself, so the rail's minimum width is the popup's (`size="rail"`). A
          panel of sections sizes to its columns, capped to the viewport so they wrap rather than run
          off the edge: a cap the design can't hold. */}
      {hasSections ? (
        <PopoverContent align="start" className="max-w-[min(72rem,calc(100vw-2rem))]">
          <RailPanelSections group={group} onNavigate={close} />
        </PopoverContent>
      ) : (
        <PopoverContent align="start" size="rail" className={railPanel()}>
          <ul className="m-0 list-none p-0">
            {[...(group.shopAll ? [group.shopAll] : []), ...group.links].map((link, index) => (
              <li key={link.key}>
                <MenuLink
                  destination={link}
                  onClick={close}
                  className={
                    index === 0 && group.shopAll
                      ? cn(railPanelShopAll(), railPanelShopAllLabel())
                      : cn(railPanelLink(), railPanelLinkLabel())
                  }
                />
              </li>
            ))}
          </ul>
        </PopoverContent>
      )}
    </Popover>
  )
}
