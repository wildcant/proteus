import type { ReactNode } from 'react'

/**
 * The body both order routes render when the read rejects.
 *
 * The copy says the order could not be loaded, not that it does not exist: a 404 and a 500
 * arrive here identically, and guessing between them would be a lie half the time. The number
 * is in the URL, so the message names it — it is the one thing a shopper can quote to support.
 *
 * The way out is a slot rather than a prop, because the two routes differ on it: a guest whose
 * confirmation failed to load has no account to go back to.
 */
export function OrderError({ orderId, children }: { orderId: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-12 pb-16 sm:px-6 lg:px-8">
      <h1 className="type-title text-ink">We couldn't load this order</h1>
      <p className="mt-4 max-w-140 text-ink-muted text-sm">
        Something went wrong loading order <span className="text-ink">{orderId}</span>. Try again in a moment — if it
        keeps happening, quote that number to us.
      </p>
      <div className="mt-10">{children}</div>
    </main>
  )
}
