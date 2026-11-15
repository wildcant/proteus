import { and, inArray, isNull, sql } from 'drizzle-orm'
import type { Context } from '../../../core/types/context.js'
import type { GeoZoneType } from '../../../core/types/fulfillment/common.js'
import type { ShippingAddressContext } from '../../../core/types/fulfillment/service.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'
import { geoZoneTable } from '../models/geo-zone.js'
import { geoZoneServesAddress } from '../utils/geo-zone-match.js'

export class GeoZoneRepository extends BaseRepository(geoZoneTable) {
  /**
   * The geo zones that cover an address, by the rule in `geoZoneServesAddress`.
   *
   * The database narrows to the address's country, which every zone type requires and the country
   * index serves; the province, city and postal comparisons then run in one place, the pure rule,
   * so the listing and a shipping method's validation cannot disagree on what "serves" means.
   */
  async findMatchingZones(address: ShippingAddressContext, context?: Context) {
    const client = this.getClient(context)

    const rows = await client
      .select()
      .from(this.table)
      .where(
        and(isNull(this.table.deletedAt), sql`lower(${this.table.countryCode}) = ${address.countryCode.toLowerCase()}`),
      )

    return rows.filter((zone) => geoZoneServesAddress({ ...zone, type: zone.type as GeoZoneType }, address))
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
