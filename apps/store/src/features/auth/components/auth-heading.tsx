import type { ReactNode } from 'react'

/**
 * Title and supporting line for an auth page. Shared so /login, /signup and the
 * check-your-email state stay typographically identical.
 */
export function AuthHeading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h1 className="type-heading text-center text-ink">{title}</h1>
      <p className="mt-4 text-center text-ink-muted text-sm">{children}</p>
    </>
  )
}
