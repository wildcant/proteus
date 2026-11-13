import { cn } from '@proteus/ui-core'
import { type MenuGroup, MenuLink } from '#/components/header/menu'
import { RailPanelColumn } from '#/components/store/rail-panel-column/rail-panel-column'
import {
  railPanelSections,
  railPanelSectionsColumns,
  railPanelSectionsFooter,
  railPanelSectionsFooterLink,
  railPanelSectionsFooterLinkLabel,
  railPanelSectionsRailPanelColumn,
} from '#/components/store/rail-panel-sections/rail-panel-sections.variants'

/** A label takes its colour from its link's hover, so it carries the fade the link's own text has (`styles.css`). */
const HOVER_FADE = 'transition-[color] ease-[ease]'

type RailPanelSectionsProps = {
  group: MenuGroup
  /** Following a link closes the panel: a navigation leaves a popover open otherwise. */
  onNavigate: () => void
}

/**
 * The panel of a menu entry with sections: one column per section, side by side, wrapping when the
 * popover reaches its cap, then the entry's footer links below a rule.
 */
export function RailPanelSections({ group, onNavigate }: RailPanelSectionsProps) {
  return (
    <div className={railPanelSections()}>
      <div className={railPanelSectionsColumns()}>
        {group.sections.map((section) => (
          <RailPanelColumn
            key={section.key}
            section={section}
            onNavigate={onNavigate}
            className={railPanelSectionsRailPanelColumn()}
          />
        ))}
      </div>
      {group.footer.length > 0 && (
        <ul className={cn('m-0 list-none p-0', railPanelSectionsFooter())}>
          {group.footer.map((link) => (
            <li key={link.key}>
              <MenuLink destination={link} onClick={onNavigate} className={railPanelSectionsFooterLink()}>
                <span className={cn(railPanelSectionsFooterLinkLabel(), HOVER_FADE)}>{link.label}</span>
              </MenuLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
