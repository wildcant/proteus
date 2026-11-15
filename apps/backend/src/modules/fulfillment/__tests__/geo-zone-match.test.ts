import { test } from '@tests/setup/test-extend.js'
import { geoZoneServesAddress, serviceZonesServingAddress } from '../utils/geo-zone-match.js'

const zone = {
  country: { type: 'country', countryCode: 'co', provinceCode: null, city: null, postalExpression: null },
  province: { type: 'province', countryCode: 'co', provinceCode: 'Antioquia', city: null, postalExpression: null },
  city: { type: 'city', countryCode: 'co', provinceCode: 'Antioquia', city: 'Medellín', postalExpression: null },
  zip: { type: 'zip', countryCode: 'co', provinceCode: 'Antioquia', city: 'Medellín', postalExpression: '050001' },
} as const

const medellin = { countryCode: 'CO', province: ' antioquia', city: 'MEDELLÍN ', postalCode: '050001 ' }

test.describe('geoZoneServesAddress', () => {
  test('each zone type narrows the one above it, compared trimmed and case-insensitively', ({ expect }) => {
    expect(Object.values(zone).map((geoZone) => geoZoneServesAddress(geoZone, medellin))).toEqual([
      true,
      true,
      true,
      true,
    ])

    // Another city in the same province: the country and province zones still serve it.
    const envigado = { ...medellin, city: 'Envigado', postalCode: '055420' }
    expect(Object.values(zone).map((geoZone) => geoZoneServesAddress(geoZone, envigado))).toEqual([
      true,
      true,
      false,
      false,
    ])

    // The same city name under another province is not the zone's city.
    expect(geoZoneServesAddress(zone.city, { ...medellin, province: 'Cundinamarca' })).toBe(false)

    // An address that names no city, or no postal code, is not inside a zone that needs one.
    expect(geoZoneServesAddress(zone.city, { countryCode: 'co', province: 'Antioquia' })).toBe(false)
    expect(geoZoneServesAddress(zone.zip, { ...medellin, postalCode: null })).toBe(false)

    // Another country matches nothing, not even its country zone.
    expect(
      Object.values(zone).some((geoZone) => geoZoneServesAddress(geoZone, { ...medellin, countryCode: 'pe' })),
    ).toBe(false)
  })

  test('a service zone serves the address when any one of its geo zones does', ({ expect }) => {
    const served = serviceZonesServingAddress(
      [
        { ...zone.city, serviceZoneId: 'sz_medellin', city: 'Bogotá' },
        { ...zone.city, serviceZoneId: 'sz_medellin' },
        { ...zone.zip, serviceZoneId: 'sz_downtown', postalExpression: '050010' },
      ],
      medellin,
    )
    expect([...served]).toEqual(['sz_medellin'])
  })
})
