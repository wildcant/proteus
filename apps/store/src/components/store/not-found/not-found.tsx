import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import {
  notFound,
  notFoundAction,
  notFoundBody,
  notFoundButton,
  notFoundCode,
  notFoundDescription,
  notFoundDescriptionText,
  notFoundTitle,
  notFoundTitleText,
  notFoundWordmark,
} from '#/components/store/not-found/not-found.variants'
import { Wordmark } from '#/components/store/wordmark/wordmark'
import { ButtonLink } from '#/components/ui/button/button'

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
    <div className={cn(notFound(), 'min-h-screen')}>
      <Wordmark className={notFoundWordmark()} />

      {/* Grows into the space below the wordmark and centres in it. As a flex item it never
          shrinks below its content, so the block never clips off the top of a short viewport. */}
      <div className={notFoundBody()}>
        {/* Not the heading: "404" read on its own announces a number, so the sentence below it is
            what carries the page in a screen reader's heading list. */}
        <p className={cn(notFoundCode(), 'm-0')}>404</p>
        <div className={notFoundTitle()}>
          <h1 className={notFoundTitleText()}>
            <Trans>We couldn&rsquo;t find that page</Trans>
          </h1>
        </div>
        <div className={notFoundDescription()}>
          <p className={cn(notFoundDescriptionText(), 'm-0 text-balance')}>
            <Trans>The link may be old, or the address slightly off.</Trans>
          </p>
        </div>
        {/* Centred as the store runs it: the set's stretched action, capped at 280px, would sit at
            the start. An instance can't override padding, so the wider desktop button is set here. */}
        <div className={notFoundAction()}>
          <ButtonLink to="/" className={cn(notFoundButton(), 'sm:px-10')}>
            <Trans>Back to home</Trans>
          </ButtonLink>
        </div>
      </div>
    </div>
  )
}
