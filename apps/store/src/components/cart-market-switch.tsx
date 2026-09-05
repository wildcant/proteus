import { useRouterState } from '@tanstack/react-router'
import { CircleAlertIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useCart, useSwitchCartMarket } from '#/features/cart/api/cart'
import { marketHref } from '#/lib/market'
import { useMarket } from '#/lib/use-market'

/**
 * Brings the cart across when the shopper changes market, and says so when it cannot come.
 *
 * Mounted at the root rather than on a layout, because entering a market is not only the control:
 * a shared `/es-CO/...` link, a bookmark and the cookie-resolved redirect at `/` all land a
 * returning shopper in a market holding a cart opened in another one. The cart id survives every
 * one of those in `localStorage`, so every one of them needs this.
 *
 * The signal is the money. A cart carries the currency of the region it was opened in, and the
 * market the page is in carries its own — two currencies on one screen is exactly the defect, and
 * comparing them is how the storefront asks the question without ever learning what a region is.
 *
 * Asking is safe when the answer is "already there": the update workflow treats a market the cart
 * is already in as no change at all.
 */
export function CartMarketSwitch() {
  const { current, markets } = useMarket()
  const { cart } = useCart()
  const switchMarket = useSwitchCartMarket()
  // The router's location, not the browser's, so this is the same on the server as after
  // hydration. The market segment has already been rewritten off it, which is what `marketHref`
  // wants: there is nothing to swap, only a prefix to add.
  const location = useRouterState({
    select: (state) => ({ pathname: state.location.pathname, search: state.location.searchStr }),
  })

  const stale = cart && cart.currencyCode !== current.currencyCode ? cart : null

  /**
   * One attempt per cart per market — until the bag itself changes.
   *
   * A refusal leaves the cart exactly where it was, so the mismatch that triggered this is still
   * true on the next render; without the record of having asked, the effect would ask again on
   * every one of them, forever. The line items are part of what was asked because they are what a
   * refusal is usually about: take the thing that is not sold here out of the bag, and the same
   * switch is worth asking for again.
   */
  const asked = useRef<string | undefined>(undefined)
  const attempt = stale ? `${stale.id}:${current.localeCode}:${stale.items.map((item) => item.id).join()}` : undefined
  const { mutate } = switchMarket

  useEffect(() => {
    if (!attempt || asked.current === attempt) return
    asked.current = attempt
    mutate()
  }, [attempt, mutate])

  // Nothing to say while it is in flight, and nothing to say once it has landed: the prices on the
  // page are the answer. This renders only for the state a shopper would otherwise have to notice
  // for themselves — a bag still quoted in the money of a market they have left.
  if (!stale || !switchMarket.isError) return null

  /**
   * The market the bag is still priced in, so leaving is one click rather than a hunt through the
   * control for whichever market that was. Found by currency because that is the only thing the
   * cart says about where it belongs; a store with two markets settling in one currency gets no
   * link rather than a guess at which of them was meant.
   */
  const priced = markets.filter((market) => market.currencyCode === stale.currencyCode)
  const [previous] = priced.length === 1 ? priced : []

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-1 bg-orange-300 px-4 py-3 text-center text-sm sm:px-6"
    >
      <span className="flex items-center gap-2 font-medium sm:gap-3">
        <CircleAlertIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
        We could not move your bag to {current.displayName}
      </span>
      <span>{switchMarket.error.message}</span>
      <span>
        It is still priced in {stale.currencyCode.toUpperCase()}
        {!!previous && (
          <>
            {' · '}
            {/* A document navigation, for the reason the market control gives: the rewrite is
                fixed when the router is created, so a client-side navigation would land the
                shopper back in the market they are trying to leave. */}
            <a
              className="font-bold underline underline-offset-4"
              href={marketHref(previous.localeCode, location, markets)}
            >
              Back to {previous.displayName}
            </a>
          </>
        )}
      </span>
    </div>
  )
}
