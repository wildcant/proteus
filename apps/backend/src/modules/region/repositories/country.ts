import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm'
import type { Context } from '../../../core/types/context.js'
import type { CountryMarketDTO } from '../../../core/types/region/common.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'
import { countryTable } from '../models/country.js'
import { regionTable } from '../models/region.js'

export class CountryRepository extends BaseRepository(countryTable) {
  /**
   * The country list a storefront renders, joined to its region for the currency and ordered in
   * the database. A left join rather than an inner one so the full listing keeps the countries
   * with no region, carrying the null currency that says so.
   *
   * `onlySellable` narrows on the joined region rather than on `regionId`, so a country whose
   * region has been soft-deleted drops out of the sellable listing instead of appearing in it
   * with no currency.
   */
  async findMarkets(onlySellable: boolean, context?: Context): Promise<CountryMarketDTO[]> {
    const client = this.getClient(context)

    const conditions = [isNull(this.table.deletedAt)]
    if (onlySellable) conditions.push(isNotNull(regionTable.id))

    return client
      .select({
        iso2: this.table.id,
        displayName: this.table.displayName,
        currencyCode: regionTable.currencyCode,
        localeCode: this.table.localeCode,
      })
      .from(this.table)
      .leftJoin(regionTable, and(eq(this.table.regionId, regionTable.id), isNull(regionTable.deletedAt)))
      .where(and(...conditions))
      .orderBy(asc(this.table.displayName))
  }
}
