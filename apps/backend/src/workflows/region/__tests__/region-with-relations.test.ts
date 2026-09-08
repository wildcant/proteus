import type { RegionPaymentProviderDTO } from '@core/types/link/common.js'
import type { PaymentProviderDTO } from '@core/types/payment/common.js'
import type { CountryDTO, RegionDTO } from '@core/types/region/common.js'
import { describe, expect, test } from 'vitest'
import { regionsWithRelations, regionWithRelations } from '../utils/region-with-relations.js'

const now = new Date('2026-01-01T00:00:00.000Z')

const region = (id: string, name: string, currencyCode: string): RegionDTO => ({
  id,
  name,
  currencyCode,
  metadata: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
})

const country = (id: string, displayName: string, regionId: string | null): CountryDTO => ({
  id,
  iso3: `${id}x`,
  numericCode: '000',
  name: displayName,
  displayName,
  regionId,
  localeCode: regionId ? 'en-US' : null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
})

const link = (regionId: string, paymentProviderId: string): RegionPaymentProviderDTO => ({
  id: `regpp_${regionId}_${paymentProviderId}`,
  regionId,
  paymentProviderId,
  createdAt: now,
  deletedAt: null,
})

const provider = (id: string, isEnabled = true): PaymentProviderDTO => ({ id, isEnabled })

describe('regionsWithRelations', () => {
  test('gives each region only its own countries and providers', () => {
    const views = regionsWithRelations(
      [region('reg_eu', 'Europe', 'eur'), region('reg_us', 'United States', 'usd')],
      [country('fr', 'France', 'reg_eu'), country('us', 'United States', 'reg_us')],
      [link('reg_eu', 'pp_stripe_default'), link('reg_us', 'pp_system_default')],
      [provider('pp_stripe_default'), provider('pp_system_default')],
    )

    expect(views[0]).toMatchObject({
      id: 'reg_eu',
      countries: [{ id: 'fr', displayName: 'France' }],
      paymentProviders: [{ id: 'pp_stripe_default', isEnabled: true }],
    })
    expect(views[1]).toMatchObject({
      id: 'reg_us',
      countries: [{ id: 'us', displayName: 'United States' }],
      paymentProviders: [{ id: 'pp_system_default', isEnabled: true }],
    })
  })

  test('a country no region sells to belongs to none of them', () => {
    const views = regionsWithRelations([region('reg_eu', 'Europe', 'eur')], [country('jp', 'Japan', null)], [], [])

    expect(views[0]?.countries).toEqual([])
  })

  test('drops a link whose provider row is gone rather than failing the region', () => {
    // A gateway removed from the deployment leaves its links behind. A merchant who can still
    // open the region is a merchant who can still repair it.
    const views = regionsWithRelations(
      [region('reg_eu', 'Europe', 'eur')],
      [],
      [link('reg_eu', 'pp_stripe_default'), link('reg_eu', 'pp_gone_default')],
      [provider('pp_stripe_default')],
    )

    expect(views[0]?.paymentProviders).toEqual([{ id: 'pp_stripe_default', isEnabled: true }])
  })

  test('carries a disabled provider a region is already linked to', () => {
    const views = regionsWithRelations(
      [region('reg_eu', 'Europe', 'eur')],
      [],
      [link('reg_eu', 'pp_stripe_default')],
      [provider('pp_stripe_default', false)],
    )

    expect(views[0]?.paymentProviders).toEqual([{ id: 'pp_stripe_default', isEnabled: false }])
  })

  test('a region with nothing attached is still a region', () => {
    expect(regionsWithRelations([region('reg_eu', 'Europe', 'eur')], [], [], [])[0]).toMatchObject({
      name: 'Europe',
      currencyCode: 'eur',
      countries: [],
      paymentProviders: [],
    })
  })
})

describe('regionWithRelations', () => {
  test('joins one region exactly as the list joins each of its own', () => {
    const [only] = regionsWithRelations(
      [region('reg_eu', 'Europe', 'eur')],
      [country('fr', 'France', 'reg_eu')],
      [link('reg_eu', 'pp_stripe_default')],
      [provider('pp_stripe_default')],
    )

    const single = regionWithRelations(
      region('reg_eu', 'Europe', 'eur'),
      [country('fr', 'France', 'reg_eu')],
      [link('reg_eu', 'pp_stripe_default')],
      [provider('pp_stripe_default')],
    )

    expect(single).toEqual(only)
  })
})
