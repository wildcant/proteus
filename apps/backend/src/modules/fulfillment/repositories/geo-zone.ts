import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import type { Context } from '../../../core/types/context.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'
import { geoZoneTable } from '../models/geo-zone.js'

export class GeoZoneRepository extends BaseRepository(geoZoneTable) {
  /**
   * Finds geo zones matching an address with cascading specificity:
   * country → province → city → zip. Returns the broadest match set
   * (all zones whose constraints are satisfied by the address).
   * TODO(shipping-options): currently filtering only by us to simplify testing.
   */
  async findMatchingZones(
    address: { countryCode: string; province?: string; city?: string; postalCode?: string },
    context?: Context,
  ) {
    const client = this.getClient(context)

    // Build OR conditions from broadest (country) to narrowest (zip).
    // A geo zone matches if all its non-null fields match the address.
    const conditions = [
      // Country-level zones
      and(eq(this.table.type, 'country'), eq(this.table.countryCode, address.countryCode)),
    ]

    // if (address.province) {
    //   conditions.push(
    //     and(
    //       eq(this.table.type, 'province'),
    //       eq(this.table.countryCode, address.countryCode),
    //       eq(this.table.provinceCode, address.province),
    //     ),
    //   )
    // }

    // if (address.province && address.city) {
    //   conditions.push(
    //     and(
    //       eq(this.table.type, 'city'),
    //       eq(this.table.countryCode, address.countryCode),
    //       eq(this.table.provinceCode, address.province),
    //       eq(this.table.city, address.city),
    //     ),
    //   )
    // }

    // Zip matching uses exact string match for now (postal_expression = postal code).
    // A regex-based approach can be added later.
    // if (address.province && address.city && address.postalCode) {
    //   conditions.push(
    //     and(
    //       eq(this.table.type, 'zip'),
    //       eq(this.table.countryCode, address.countryCode),
    //       eq(this.table.provinceCode, address.province),
    //       eq(this.table.city, address.city),
    //       eq(this.table.postalExpression, address.postalCode),
    //     ),
    //   )
    // }

    const rows = await client
      .select()
      .from(this.table)
      .where(and(isNull(this.table.deletedAt), or(...conditions)))

    return rows
  }

  async findByServiceZoneIds(serviceZoneIds: string[], context?: Context) {
    if (serviceZoneIds.length === 0) return []
    const client = this.getClient(context)
    const rows = await client
      .select()
      .from(this.table)
      .where(and(inArray(this.table.serviceZoneId, serviceZoneIds), isNull(this.table.deletedAt)))
    return rows
  }
}
