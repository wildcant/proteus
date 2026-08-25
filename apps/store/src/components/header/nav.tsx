import { cn } from '@proteus/ui'
import { Link } from '@tanstack/react-router'

/**
 * There is no category taxonomy in the backend yet, so the rail ships with the one
 * destination that exists. It is laid out to take N entries, which is what lets a later
 * categories ticket fill it without touching this file.
 */
const railLinks = [{ to: '/products' as const, label: 'Shop all' }]

/**
 * The storefront's primary navigation, and the only part of the header that is navigation
 * in the landmark sense — which is why the `<nav>` element lives here rather than around
 * the whole bar. The wordmark, search, account and bag are the header's other business.
 *
 * Desktop only. Below `lg` the side menu carries these same destinations, so a rail that
 * merely collapsed would be the same links twice.
 */
type NavProps = {
  className?: string
}

export function Nav({ className }: NavProps) {
  return (
    <nav className={cn('hidden lg:block', className)}>
      <ul className="m-0 flex list-none items-center gap-8 p-0">
        {railLinks.map(({ to, label }) => (
          <li key={to}>
            <Link to={to} className="font-medium text-ink text-sm no-underline hover:text-ink-muted">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
