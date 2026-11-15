import type { Context } from '@core/types/context.js'
import { BaseRepository } from '@core/utils/base-repository.js'
import { and, isNull, sql } from 'drizzle-orm'
import { fixtureShippingRateTable } from '../models/shipping-rate.js'

export class FixtureShippingRateRepository extends BaseRepository(fixtureShippingRateTable) {
  async findByCity(city: string, context?: Context) {
    const [rate] = await this.getClient(context)
      .select()
      .from(this.table)
      .where(and(isNull(this.table.deletedAt), sql`lower(trim(${this.table.city})) = ${city.trim().toLowerCase()}`))
      .limit(1)
    return rate ?? null
  }
}
