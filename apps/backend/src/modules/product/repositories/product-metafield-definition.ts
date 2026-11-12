import type { Context } from '../../../core/types/context.js'
import type { UpsertProductMetafieldDefinitionDTO } from '../../../core/types/product/mutations.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'
import { productMetafieldDefinitionTable } from '../models/product-metafield-definition.js'

export class ProductMetafieldDefinitionRepository extends BaseRepository(productMetafieldDefinitionTable) {
  /**
   * Creates each live definition whose key is new and updates the ones that changed. Each one's rank is
   * its place in `data`, so the order given is the order the filters show in.
   */
  async upsertByKey(data: UpsertProductMetafieldDefinitionDTO[], context?: Context) {
    if (data.length === 0) return []
    const existing = await this.find({ key: data.map((definition) => definition.key) }, undefined, context)
    const byKey = new Map(existing.map((definition) => [definition.key, definition]))
    return Promise.all(
      data.map(({ key, name, filterable = false, source = 'metafield' }, rank) => {
        const definition = byKey.get(key)
        if (!definition) return this.create({ key, name, filterable, rank, source }, context)
        const unchanged =
          definition.name === name &&
          definition.filterable === filterable &&
          definition.rank === rank &&
          definition.source === source
        if (unchanged) return definition
        return this.update(definition.id, { name, filterable, rank, source }, context)
      }),
    )
  }
}
