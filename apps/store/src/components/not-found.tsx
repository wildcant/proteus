import { ButtonLink } from '#/components/button'
import { Wordmark } from '#/components/header/wordmark'

/**
 * What every unmatched URL answers with, wired to the router as `defaultNotFoundComponent`.
 *
 * It stands on its own rather than inside the shop chrome: a not-found is raised at `__root__`,
 * above the layout route that owns the header and footer, and reaching for them here would mean
 * rendering a market selector and a bag on an address that resolved to no market at all.
 *
 * The wordmark is the only chrome, the same bargain `_auth` makes — and it is a link, so leaving
 * stays one click away even before the shopper reaches the button.
 */
export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-10 sm:py-14">
      <Wordmark />

      {/* my-auto rather than justify-center, so the block never clips off the top of a short
          viewport — the same reason `_auth` centres this way. */}
      <div className="my-auto flex w-full flex-col items-center text-center">
        {/* Not the heading: "404" read on its own announces a number, so the sentence below it is
            what carries the page in a screen reader's heading list. */}
        <p className="type-display m-0 text-ink">404</p>
        <h1 className="mt-6 text-base text-ink">We couldn&rsquo;t find that page</h1>
        <p className="m-0 mt-2 max-w-100 text-balance text-ink-muted text-sm">
          The link may be old, or the address slightly off.
        </p>
        <ButtonLink to="/" className="mt-8 w-full max-w-70 sm:w-auto sm:px-10">
          Back to home
        </ButtonLink>
      </div>
    </div>
  )
}
