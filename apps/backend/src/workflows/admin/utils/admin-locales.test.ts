import type { CountryMarketDTO } from '@core/types/region/common.js'
import { describe, expect, test } from 'vitest'
import { adminLocales } from './admin-locales.js'

/** A sellable market in `localeCode`; the other fields do not decide the picker. */
const marketIn = (localeCode: string | null) => ({ localeCode }) as CountryMarketDTO

describe('adminLocales', () => {
  test('offers en-US first, then every sellable market Locale', () => {
    expect(adminLocales([])).toEqual(['en-US'])
    expect(adminLocales([marketIn('es-CO'), marketIn('en-US'), marketIn(null)])).toEqual(['en-US', 'es-CO'])
  })

  test('never offers a market Locale in a language the admin has no catalog for', () => {
    expect(adminLocales([marketIn('fr-FR'), marketIn('es-MX'), marketIn('pt-BR')])).toEqual(['en-US', 'es-MX'])
  })
})
