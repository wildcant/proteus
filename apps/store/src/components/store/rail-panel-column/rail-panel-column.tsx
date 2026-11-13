import { cn } from '@proteus/ui-core'
import { type MenuGroupSection, MenuLink } from '#/components/header/menu'
import {
  railPanelColumn,
  railPanelColumnChip,
  railPanelColumnChipLabel,
  railPanelColumnChips,
  railPanelColumnLink,
  railPanelColumnLinkLabel,
  railPanelColumnLinks,
  railPanelColumnNote,
  railPanelColumnNoteLabel,
  railPanelColumnTitle,
  railPanelColumnTitleLabel,
  railPanelColumnViewAll,
  railPanelColumnViewAllLabel,
} from '#/components/store/rail-panel-column/rail-panel-column.variants'

/** A label takes its colour from its link's hover, so it carries the fade the link's own text has (`styles.css`). */
const HOVER_FADE = 'transition-[color] ease-[ease]'

type RailPanelColumnProps = {
  section: MenuGroupSection
  /** Following a link closes the panel: a navigation leaves a popover open otherwise. */
  onNavigate: () => void
  className?: string
}

/**
 * One titled column of a menu entry's panel: its links, or its sizes as chips, closed by its
 * "View all" and its note. Each link's label is a span of its own, so it takes the link's hover.
 */
export function RailPanelColumn({ section, onNavigate, className }: RailPanelColumnProps) {
  const chips = section.display === 'chips'

  return (
    <section className={cn(railPanelColumn(), className)}>
      <h3 className={cn('m-0', railPanelColumnTitle(), railPanelColumnTitleLabel())}>{section.title}</h3>
      <ul className={cn('m-0 list-none p-0', chips ? railPanelColumnChips() : railPanelColumnLinks())}>
        {section.links.map((link) => (
          <li key={link.key}>
            <MenuLink
              destination={link}
              onClick={onNavigate}
              className={chips ? railPanelColumnChip() : railPanelColumnLink()}
            >
              <span className={cn(chips ? railPanelColumnChipLabel() : railPanelColumnLinkLabel(), HOVER_FADE)}>
                {link.label}
              </span>
            </MenuLink>
          </li>
        ))}
      </ul>
      {!!section.viewAll && (
        <MenuLink destination={section.viewAll} onClick={onNavigate} className={railPanelColumnViewAll()}>
          <span className={cn(railPanelColumnViewAllLabel(), HOVER_FADE)}>{section.viewAll.label}</span>
        </MenuLink>
      )}
      {!!section.note && <p className={cn('m-0', railPanelColumnNote(), railPanelColumnNoteLabel())}>{section.note}</p>}
    </section>
  )
}
