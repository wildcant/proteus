import { cn } from '@proteus/ui-core'
import { type MenuGroup, MenuLink } from '#/components/header/menu'
import {
  sideMenuGroup,
  sideMenuGroupFooterLink,
  sideMenuGroupFooterLinkLabel,
  sideMenuGroupRow,
  sideMenuGroupRowLabel,
  sideMenuGroupSection,
  sideMenuGroupSideMenuSection,
} from '#/components/store/side-menu-group/side-menu-group.variants'
import { SideMenuSection } from '#/components/store/side-menu-section/side-menu-section'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '#/components/ui/accordion/accordion'

/** A label takes its colour from its link's hover, so it carries the fade the link's own text has (`styles.css`). */
const HOVER_FADE = 'transition-[color] ease-[ease]'

/**
 * The panel of an open menu entry in the side menu: its own links as rows, each section as a group
 * of its own expanding in place like the entry, then its footer links. Following any link closes the
 * menu for free — see `SideMenu` — so this holds no state.
 */
export function SideMenuGroup({ group }: { group: MenuGroup }) {
  const rows = group.shopAll ? [group.shopAll, ...group.links] : group.links

  return (
    <ul className={cn('m-0 list-none p-0', sideMenuGroup())}>
      {rows.map((link) => (
        <li key={link.key}>
          <MenuLink destination={link} className={sideMenuGroupRow()}>
            <span className={cn(sideMenuGroupRowLabel(), HOVER_FADE)}>{link.label}</span>
          </MenuLink>
        </li>
      ))}
      {group.sections.map((section) => (
        <li key={section.key}>
          <Accordion variant="section" className={sideMenuGroupSection()}>
            <AccordionItem value={section.key}>
              <AccordionTrigger>{section.title}</AccordionTrigger>
              <AccordionContent>
                <SideMenuSection section={section} className={sideMenuGroupSideMenuSection()} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </li>
      ))}
      {group.footer.map((link) => (
        <li key={link.key}>
          <MenuLink destination={link} className={sideMenuGroupFooterLink()}>
            <span className={cn(sideMenuGroupFooterLinkLabel(), HOVER_FADE)}>{link.label}</span>
          </MenuLink>
        </li>
      ))}
    </ul>
  )
}
