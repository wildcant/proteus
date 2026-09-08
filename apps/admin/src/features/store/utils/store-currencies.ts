import type { AdminStoreCurrency } from '#/api/generated/model'

/**
 * The currency codes the picker may offer: every one the runtime can name, minus the ones the
 * store already trades in.
 *
 * `Intl.supportedValuesOf` rather than a table of codes, for the same reason `getCurrencyName`
 * derives its labels: the runtime already ships ISO 4217, and a copy of it here would only be a
 * list going stale. It also guarantees the two agree — every code offered is one the label lookup
 * can name, so no row of the picker reads as a bare code.
 *
 * Codes rather than labelled options, so this stays a pure function the unit suite can run: the
 * labels come from `@proteus/ui`, which is React and therefore the browser's half of the split.
 *
 * Already-held codes are excluded rather than shown disabled: the API ignores a duplicate, so
 * offering one would be offering an action with no effect.
 */
export function selectableCurrencyCodes(heldCodes: string[]): string[] {
  const held = new Set(heldCodes.map((code) => code.toLowerCase()))

  return Intl.supportedValuesOf('currency')
    .map((code) => code.toLowerCase())
    .filter((code) => !held.has(code))
}

/** What the Currencies table's row menu offers for one row, and what it withholds. */
export type StoreCurrencyRowActions = {
  canMakeDefault: boolean
  canRemove: boolean
  /** Why Remove is withheld, in words a merchant can act on. `null` when it is offered. */
  removeBlockedReason: string | null
}

/**
 * The row menu's two entries, decided from the row alone.
 *
 * Only one of the API's two removal guards can be answered here. That the default cannot be
 * removed is visible in the row — so the menu says so rather than letting the merchant click into
 * a refusal. That a region settles in the currency is not: the store payload carries no regions,
 * and a table that asked for them would be reading a second resource to grey out a menu item. That
 * one stays the API's refusal, carried back by the mutation's toast, which names the region.
 *
 * Nominating the currency that is already the default is withheld for the same reason: the API
 * accepts it, and it does nothing.
 */
export function storeCurrencyActions(currency: AdminStoreCurrency): StoreCurrencyRowActions {
  if (currency.isDefault) {
    return {
      canMakeDefault: false,
      canRemove: false,
      removeBlockedReason: "This is the store's default currency. Make another currency the default first.",
    }
  }

  return { canMakeDefault: true, canRemove: true, removeBlockedReason: null }
}

/**
 * The currency the store is denominated in — the one the Store card names.
 *
 * `undefined` when the store trades in nothing yet, which is the only way to reach it: the API
 * makes the first currency added the default and refuses to remove one.
 */
export function defaultCurrency(currencies: AdminStoreCurrency[]): AdminStoreCurrency | undefined {
  return currencies.find((currency) => currency.isDefault)
}
