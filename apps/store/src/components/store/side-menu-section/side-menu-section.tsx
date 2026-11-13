import { cn } from '@proteus/ui-core'
import { type MenuGroupSection, MenuLink } from '#/components/header/menu'
import {
  sideMenuSection,
  sideMenuSectionChip,
  sideMenuSectionChipLabel,
  sideMenuSectionChips,
  sideMenuSectionLink,
  sideMenuSectionLinkLabel,
  sideMenuSectionLinks,
  sideMenuSectionNote,
  sideMenuSectionNoteLabel,
  sideMenuSectionViewAll,
  sideMenuSectionViewAllLabel,
} from '#/components/store/side-menu-section/side-menu-section.variants'

/** A label takes its colour from its link's hover, so it carries the fade the link's own text has (`styles.css`). */
const HOVER_FADE = 'transition-[color] ease-[ease]'

/**
 * One section's panel in the side menu, inside its accordion: its links as rows, or its sizes as
 * chips, then its "View all" and its note. Following a link closes the menu for free (`SideMenu`).
 */
export function SideMenuSection({ section, className }: { section: MenuGroupSection; className?: string }) {
  const chips = section.display === 'chips'

  return (
    <div className={cn(sideMenuSection(), className)}>
      <ul className={cn('m-0 list-none p-0', chips ? sideMenuSectionChips() : sideMenuSectionLinks())}>
        {section.links.map((link) => (
          <li key={link.key}>
            {chips ? (
              // No hover of its own: a chip is a touch target, its label the link's own text.
              <MenuLink destination={link} className={cn(sideMenuSectionChip(), sideMenuSectionChipLabel())} />
            ) : (
              <MenuLink destination={link} className={sideMenuSectionLink()}>
                <span className={cn(sideMenuSectionLinkLabel(), HOVER_FADE)}>{link.label}</span>
              </MenuLink>
            )}
          </li>
        ))}
      </ul>
      {!!section.viewAll && (
        <MenuLink destination={section.viewAll} className={sideMenuSectionViewAll()}>
          <span className={cn(sideMenuSectionViewAllLabel(), HOVER_FADE)}>{section.viewAll.label}</span>
        </MenuLink>
      )}
      {!!section.note && <p className={cn('m-0', sideMenuSectionNote(), sideMenuSectionNoteLabel())}>{section.note}</p>}
    </div>
  )
}
