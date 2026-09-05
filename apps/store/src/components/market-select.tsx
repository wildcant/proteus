import { ChevronDownIcon } from 'lucide-react'
import { marketHref } from '#/lib/market'
import { useMarket } from '#/lib/use-market'

/**
 * Which market the shopper is buying in — and with it, since a region owns a currency, which money
 * they are quoted. There is no separate currency control on purpose: two controls would be two
 * things to get out of step, and only one of them is a question a shopper can answer.
 *
 * The options are the markets the store actually sells in, straight off the country endpoint, so a
 * market added by a merchant appears here without a storefront release.
 *
 * A native `<select>` for the reason `product-sort.tsx` gives: the platform renders the bottom
 * sheet a phone wants and this file owns no modal state.
 */
export function MarketSelect() {
  const { current, markets } = useMarket()

  return (
    <div className="flex items-center gap-2">
      <label className="text-ink-muted text-sm" htmlFor="market">
        Market
      </label>
      <div className="relative">
        <select
          id="market"
          value={current.localeCode}
          // A document navigation, not `navigate({ to })`. The rewrite is fixed when the router is
          // created, so a client-side navigation would re-apply the market the page is already in
          // and land the shopper back where they started. The full load is also what re-renders
          // the SSR'd prices in the new currency, and what lets the request middleware write the
          // market cookie — the whole switch is this one line plus the response to it.
          onChange={(event) => window.location.assign(marketHref(event.target.value, window.location, markets))}
          // 16px below `md` so iOS does not zoom the page on focus.
          className="h-11 cursor-pointer appearance-none bg-transparent py-0 pr-6 pl-0 text-base text-ink outline-none md:text-sm"
        >
          {markets.map((market) => (
            <option key={market.localeCode} value={market.localeCode}>
              {market.displayName}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-0 size-4 -translate-y-1/2 text-ink-muted"
        />
      </div>
    </div>
  )
}
