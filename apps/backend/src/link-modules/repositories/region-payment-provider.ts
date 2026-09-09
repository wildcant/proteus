import { and, inArray, isNull } from 'drizzle-orm'
import type { Context } from '../../core/types/context.js'
import { BaseRepository } from '../../core/utils/base-repository.js'
import { regionPaymentProviderTable } from '../definitions/region-payment-provider.js'

export class RegionPaymentProviderRepository extends BaseRepository(regionPaymentProviderTable) {
  async findByRegionIds(regionIds: string[], context?: Context) {
    if (regionIds.length === 0) return []
    const client = this.getClient(context)
    return client
      .select()
      .from(this.table)
      .where(and(inArray(this.table.regionId, regionIds), isNull(this.table.deletedAt)))
  }
}
