import { cn } from '@proteus/ui'
import { ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'
import { isMenuGroup, type MenuGroup, MenuLink, useMenuEntries } from '#/components/header/menu'
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
 * A Category with children, or an entry with sections, opens a panel rather than navigating, its
 * "Shop all" first and set apart, since the trigger no longer goes there. Sections lay out as one
 * titled column each, side by side. Controlled so that following a link closes it — a navigation
 * leaves a popover open otherwise.
 */
function RailPanel({ group }: { group: MenuGroup }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const panelLinkClassName = 'block px-4 py-2 text-ink text-sm no-underline hover:bg-surface-subtle'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn('flex cursor-pointer items-center gap-1', railItemClassName)}>
        {group.label}
        <ChevronDownIcon className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className={cn('py-2', group.sections.length > 0 ? 'w-auto max-w-4xl' : 'min-w-56')}>
        <ul className="m-0 list-none p-0">
          {[group.shopAll, ...group.links].map((link, index) => (
            <li key={link.key}>
              <MenuLink
                destination={link}
                onClick={close}
                className={cn(panelLinkClassName, index === 0 && 'font-medium')}
              />
            </li>
          ))}
        </ul>
        {group.sections.length > 0 && (
          <div className="flex gap-6 py-2">
            {group.sections.map((section) => (
              <section key={section.key} className="min-w-40">
                <h3 className="m-0 px-4 py-2 font-medium text-ink-muted text-xs uppercase">{section.title}</h3>
                <ul className="m-0 list-none p-0">
                  {section.links.map((link) => (
                    <li key={link.key}>
                      <MenuLink destination={link} onClick={close} className={panelLinkClassName} />
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
