import { describe, expect, it } from 'vitest'
import type { AdminStoreCurrency } from '#/api/generated/model'
import { defaultCurrency, selectableCurrencyCodes, storeCurrencyActions } from './store-currencies'

const currency = (currencyCode: string, isDefault = false): AdminStoreCurrency => ({ currencyCode, isDefault })

describe('selectableCurrencyCodes', () => {
  it('offers the ISO 4217 list the runtime ships, lowercased like every code the API carries', () => {
    const offered = selectableCurrencyCodes([])

    expect(offered.length).toBeGreaterThan(100)
    expect(offered).toContain('eur')
    expect(offered).not.toContain('EUR')
  })

  it('excludes the currencies the store already trades in', () => {
    const offered = selectableCurrencyCodes(['usd', 'cop'])

    expect(offered).not.toContain('usd')
    expect(offered).not.toContain('cop')
    expect(offered).toContain('eur')
  })

  it('takes held codes in either case, since a code can reach it from either side', () => {
    expect(selectableCurrencyCodes(['USD'])).not.toContain('usd')
  })
})

describe('storeCurrencyActions', () => {
  it('offers both entries on an ordinary currency', () => {
    expect(storeCurrencyActions(currency('cop'))).toEqual({
      canMakeDefault: true,
      canRemove: true,
      removeBlockedReason: null,
    })
  })

  it('withholds Remove on the default, with the reason the API would otherwise answer with', () => {
    // The refusal exists either way; showing it in the menu is what saves the merchant a click
    // into a 400 that tells them the same thing.
    const actions = storeCurrencyActions(currency('usd', true))

    expect(actions.canRemove).toBe(false)
    expect(actions.removeBlockedReason).toContain('default currency')
  })

  it('withholds Make default on the currency that already is one', () => {
    expect(storeCurrencyActions(currency('usd', true)).canMakeDefault).toBe(false)
  })

  it('says nothing about a currency a region settles in, which the row cannot see', () => {
    // The store payload carries no regions. That guard is the API's, and its refusal names the
    // region — which is the part a greyed-out menu item could not have said.
    expect(storeCurrencyActions(currency('cop')).canRemove).toBe(true)
  })
})

describe('defaultCurrency', () => {
  it('finds the currency the store is denominated in', () => {
    expect(defaultCurrency([currency('cop'), currency('usd', true)])).toEqual(currency('usd', true))
  })

  it('is undefined for a store that trades in nothing yet, which is the only way to reach it', () => {
    expect(defaultCurrency([])).toBeUndefined()
  })
})
