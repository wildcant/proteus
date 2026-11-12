import { cn } from '@proteus/ui'
import { ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'
import { isMenuGroup, type MenuGroup, MenuLink, useMenuEntries, useViewAllLabel } from '#/components/header/menu'
import type { MenuSource } from '#/components/header/menu-items'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/popover'

const railItemClassName = 'font-medium text-ink text-sm no-underline hover:text-ink-muted'

/**
 * The storefront's primary navigation, and the only part of the header that is navigation
 * in the landmark sense — which is why the `<nav>` element lives here rather than around
 * the whole bar. The wordmark, search, account and bag are the header's other business.
 *
 * Desktop only. Below `lg` the side menu carries these same destinations, so a rail that
 * merely collapsed would be the same links twice.
 */
type NavProps = {
  menu: MenuSource
  className?: string
}

export function Nav({ menu, className }: NavProps) {
  const entries = useMenuEntries(menu)

  return (
    <nav className={cn('hidden lg:block', className)}>
      <ul className="m-0 flex list-none items-center gap-8 p-0">
        {entries.map((entry) => (
          <li key={entry.key}>
            {isMenuGroup(entry) ? (
              <RailPanel group={entry} />
            ) : (
              <MenuLink destination={entry} className={railItemClassName} />
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * A Category with children, or an entry with sections, opens a panel rather than navigating.
 * Children list under "Shop all" first and set apart, since the trigger no longer goes there.
 * Sections lay out as one titled column each, side by side — links, or chips for sizes — each closed
 * by its "View all" and its note, with the entry's footer links below a rule. Controlled so that
 * following a link closes it — a navigation leaves a popover open otherwise.
 */
function RailPanel({ group }: { group: MenuGroup }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const viewAllLabel = useViewAllLabel()
  const panelLinkClassName = 'block px-4 py-2 text-ink text-sm no-underline hover:bg-surface-subtle'
  const columnLinkClassName = 'block py-1.5 text-ink-muted text-sm no-underline hover:text-ink'
  const listed = group.shopAll ? [group.shopAll, ...group.links] : group.links

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn('flex cursor-pointer items-center gap-1', railItemClassName)}>
        {group.label}
        <ChevronDownIcon className="size-4" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        // Capped to the viewport, so a panel of many columns wraps them rather than running off the edge.
        className={cn(
          group.sections.length > 0 ? 'w-auto max-w-[min(72rem,calc(100vw-2rem))] px-8 py-6' : 'min-w-56 py-2',
        )}
      >
        {listed.length > 0 && (
          <ul className="m-0 list-none p-0">
            {listed.map((link, index) => (
              <li key={link.key}>
                <MenuLink
                  destination={link}
                  onClick={close}
                  className={cn(panelLinkClassName, index === 0 && group.shopAll && 'font-medium')}
                />
              </li>
            ))}
          </ul>
        )}
        {group.sections.length > 0 && (
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
                    destination={{ ...section.viewAll, label: viewAllLabel(section.viewAll.name) }}
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
