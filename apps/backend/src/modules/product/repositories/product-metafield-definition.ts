import type { Context } from '../../../core/types/context.js'
import type { UpsertProductMetafieldDefinitionDTO } from '../../../core/types/product/mutations.js'
import { BaseRepository } from '../../../core/utils/base-repository.js'
import { productMetafieldDefinitionTable } from '../models/product-metafield-definition.js'

export class ProductMetafieldDefinitionRepository extends BaseRepository(productMetafieldDefinitionTable) {
  /** Creates each live definition whose key is new and renames the ones whose name changed. */
  async upsertByKey(data: UpsertProductMetafieldDefinitionDTO[], context?: Context) {
    if (data.length === 0) return []
    const existing = await this.find({ key: data.map((definition) => definition.key) }, undefined, context)
    const byKey = new Map(existing.map((definition) => [definition.key, definition]))
    return Promise.all(
      data.map(({ key, name }) => {
        const definition = byKey.get(key)
        if (!definition) return this.create({ key, name }, context)
        if (definition.name === name) return definition
        return this.update(definition.id, { name }, context)
      }),
    )
  }
}
