import { cn, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@proteus/ui'
import { ChevronDownIcon } from 'lucide-react'
import { useMarket } from '#/hooks/use-market'
import { marketHref } from '#/lib/market'

/** The first regional indicator, `🇦`. Two of them in sequence are how a flag emoji is spelled. */
const REGIONAL_INDICATOR_A = 0x1f1e6

/**
 * Which market the shopper is buying in — and with it, since a region owns a currency, which money
 * they are quoted. There is no separate currency control on purpose: two controls would be two
 * things to get out of step, and only one of them is a question a shopper can answer.
 *
 * The options are the markets the store actually sells in, straight off the country endpoint, so a
 * market added by a merchant appears here without a storefront release.
 *
 * A menu rather than a native `<select>`: the list carries a flag per row and fills the market the
 * shopper is already in, and an `<option>` is drawn by the browser — it can hold neither. The cost
 * is the phone's bottom sheet, which is why the rows are 44px and the trigger is one too.
 */
export function MarketSelect() {
  const { current, markets } = useMarket()

  return (
    <DropdownMenu>
      {/* The name is on the trigger rather than beside it: the flag is decorative, so without it
          the button announces a country with no indication of what choosing one would do. */}
      <DropdownMenuTrigger
        aria-label={`Market: ${current.displayName}`}
        className="flex h-11 cursor-pointer items-center gap-2 font-semibold text-ink text-sm uppercase tracking-wide outline-none"
      >
        <MarketFlag iso2={current.iso2} />
        {current.displayName}
        <ChevronDownIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>

      {/* Above, because this lives on the footer's last bar and there is nothing below it, and
          aligned to the trigger's own edge so the panel stays inside the footer's gutter rather
          than being pushed against the viewport. The store's popover edge — a border rather than
          the primitive's ring — from `popover.tsx`. */}
      <DropdownMenuContent side="top" align="end" sideOffset={8} className="w-56 border p-2 shadow-xl ring-0">
        {markets.map((market) => (
          <DropdownMenuItem
            key={market.localeCode}
            data-current={market.localeCode === current.localeCode ? '' : undefined}
            // A document navigation, not `navigate({ to })`. The rewrite is fixed when the router is
            // created, so a client-side navigation would re-apply the market the page is already in
            // and land the shopper back where they started. The full load is also what re-renders
            // the SSR'd prices in the new currency, and what lets the request middleware write the
            // market cookie — the whole switch is this one line plus the response to it.
            onClick={() => window.location.assign(marketHref(market.localeCode, window.location, markets))}
            className={cn(
              'h-11 cursor-pointer gap-3 px-3 font-bold text-base text-ink',
              // A rule between rows, and none against the filled one: the fill is already the
              // edge there, and a line running into it reads as a row split in two.
              'border-line border-t first:border-transparent data-current:border-transparent [[data-current]+&]:border-transparent',
              'data-current:bg-ink data-current:text-surface',
              // The primitive highlights with `--accent`, which the store points at the one hue it
              // has. A market is not a call to action; it takes the neutral surface instead.
              'focus:bg-surface-subtle focus:text-ink data-current:focus:bg-ink data-current:focus:text-surface',
            )}
          >
            <MarketFlag iso2={market.iso2} />
            {market.displayName}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The market's flag, spelled out of the two letters of its ISO code as regional indicators, so no
 * flag artwork ships with the storefront.
 *
 * Decorative, and deliberately never the only thing a row carries: Windows has no flag glyphs and
 * renders the letter pair instead, which is a country the shopper has to decode rather than read.
 */
function MarketFlag({ iso2 }: { iso2: string }) {
  const flag = [...iso2.toUpperCase()]
    .map((letter) => String.fromCodePoint(REGIONAL_INDICATOR_A + letter.charCodeAt(0) - 'A'.charCodeAt(0)))
    .join('')

  return (
    <span aria-hidden="true" className="text-lg leading-none">
      {flag}
    </span>
  )
}
