import type { GeoZoneDTO } from '../../../core/types/fulfillment/common.js'
import type { ShippingAddressContext } from '../../../core/types/fulfillment/service.js'

type MatchableGeoZone = Pick<GeoZoneDTO, 'type' | 'countryCode' | 'provinceCode' | 'city' | 'postalExpression'>

/**
 * How a shopper's spelling and a zone's are compared: trimmed and case-insensitive, so «Bogotá »
 * typed in a cart reaches the zone the admin wrote as «bogotá». Accents are kept, because they are
 * part of a name rather than of its casing. An absent value never equals anything.
 */
function normalized(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase()
  return trimmed ? trimmed : null
}

function same(zoneValue: string | null | undefined, addressValue: string | null | undefined): boolean {
  const zone = normalized(zoneValue)
  return zone !== null && zone === normalized(addressValue)
}

/**
 * Whether one geo zone covers the address, by Medusa's rule: each zone type narrows the one above
 * it, so a country zone needs the country, a province zone the country and province, a city zone
 * those and the city, and a postal-code zone those and the postal code. The postal code is compared
 * as a literal code, as Medusa reads `postal_expression`.
 *
 * A service zone serves the address when any of its geo zones does.
 */
export function geoZoneServesAddress(zone: MatchableGeoZone, address: ShippingAddressContext): boolean {
  if (!same(zone.countryCode, address.countryCode)) return false
  if (zone.type === 'country') return true

  if (!same(zone.provinceCode, address.province)) return false
  if (zone.type === 'province') return true

  if (!same(zone.city, address.city)) return false
  if (zone.type === 'city') return true

  return zone.type === 'zip' && same(zone.postalExpression, address.postalCode)
}

/** The service zones, among those the geo zones belong to, that serve the address. */
export function serviceZonesServingAddress(
  geoZones: (MatchableGeoZone & { serviceZoneId: string })[],
  address: ShippingAddressContext,
): Set<string> {
  return new Set(geoZones.filter((zone) => geoZoneServesAddress(zone, address)).map((zone) => zone.serviceZoneId))
}
