import type { ReactNode } from 'react'

type CheckoutSectionProps = {
  title: string
  /** Right-hand slot on the title row — the Sign in link, and nothing else so far. */
  action?: ReactNode
  children: ReactNode
}

/**
 * One block of the one-page checkout, separated by space rather than rules — `space-y-8` on the
 * stack, not a border here. No `isOpen` / `isComplete` / `onEdit` like the old `CheckoutStep`: none
 * of the three means anything once every section is visible at once. No description slot either.
 */
export function CheckoutSection({ title, action, children }: CheckoutSectionProps) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="type-heading m-0 text-ink">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}
