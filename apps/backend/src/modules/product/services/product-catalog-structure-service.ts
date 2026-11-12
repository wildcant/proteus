import type { Context } from '../../../core/types/context.js'
import type {
  CatalogStructureChangesDTO,
  CatalogStructureDTO,
  CatalogStructurePlanDTO,
} from '../../../core/types/product/common.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { ProductCategoryRepository } from '../repositories/product-category.js'
import type { ProductCollectionRepository } from '../repositories/product-collection.js'
import type { ProductMetafieldDefinitionRepository } from '../repositories/product-metafield-definition.js'
import { MAX_STRUCTURE_FILE_BYTES, parseCatalogStructure } from '../utils/catalog-structure/parse-catalog-structure.js'
import {
  absentCategoryLevels,
  absentMetafieldDefinitions,
  flattenStructureCategories,
  type LiveCatalogStructure,
  planCatalogStructureChanges,
} from '../utils/catalog-structure/plan-catalog-structure-changes.js'
import type { ProductCategoryService } from './product-category-service.js'
import type { ProductGroupingService } from './product-grouping-service.js'
import type { ProductRuleMembershipService } from './product-rule-membership-service.js'

type InjectedDependencies = {
  productCategoryRepository: ProductCategoryRepository
  productCollectionRepository: ProductCollectionRepository
  productMetafieldDefinitionRepository: ProductMetafieldDefinitionRepository
  withTransaction: WithTransaction
}

type Collaborators = {
  productCategoryService: ProductCategoryService
  productGroupingService: ProductGroupingService
  productRuleMembershipService: ProductRuleMembershipService
}

const NO_CHANGES: CatalogStructureChangesDTO = {
  metafields: { create: [], update: [], delete: [] },
  categories: { create: [], update: [], move: [], delete: [] },
  collections: { create: [], update: [], delete: [] },
}

/**
 * Applies a structure file (`estructura.yaml`) to the metafield definitions, the Categories and the
 * Collections. The file is the source: definitions are matched by key and groupings by handle, the
 * ones it names are made to read as it says, and the ones it leaves out are deleted.
 *
 * **Internal to the module**, like `ProductCategoryService`, whose tree rules it writes through. The
 * menu the file also carries belongs to the store module; this reads it and leaves it for the caller.
 */
export class ProductCatalogStructureService {
  private productCategoryRepository: ProductCategoryRepository
  private productCollectionRepository: ProductCollectionRepository
  private productMetafieldDefinitionRepository: ProductMetafieldDefinitionRepository
  private withTransaction: WithTransaction
  private productCategoryService: ProductCategoryService
  private productGroupingService: ProductGroupingService
  private productRuleMembershipService: ProductRuleMembershipService

  constructor(dependencies: InjectedDependencies, collaborators: Collaborators) {
    this.productCategoryRepository = dependencies.productCategoryRepository
    this.productCollectionRepository = dependencies.productCollectionRepository
    this.productMetafieldDefinitionRepository = dependencies.productMetafieldDefinitionRepository
    this.withTransaction = dependencies.withTransaction
    this.productCategoryService = collaborators.productCategoryService
    this.productGroupingService = collaborators.productGroupingService
    this.productRuleMembershipService = collaborators.productRuleMembershipService
  }

  async planCatalogStructure(
    source: AsyncIterable<Uint8Array | string>,
    context?: Context,
  ): Promise<CatalogStructurePlanDTO> {
    const text = await this.readText(source)
    if (text === null) {
      return {
        structure: null,
        errors: [{ path: '', message: `The file is larger than ${MAX_STRUCTURE_FILE_BYTES / 1024} KB.` }],
        changes: NO_CHANGES,
      }
    }

    const { structure, errors } = parseCatalogStructure(text)
    if (!structure) return { structure, errors, changes: NO_CHANGES }

    const live = await this.readLive(context)
    return { structure, errors, changes: planCatalogStructureChanges(structure, live) }
  }

  /**
   * One transaction: the metafield definitions first, so every rule names one, and the ones the file
   * leaves out deleted with their values; then Categories parents first, so a move never lands under
   * its own subtree, each placed at its file rank and made active; then Collections; then the
   * groupings the file leaves out, leaf-first so no deletion meets a live child; then every ruled
   * grouping re-matched.
   */
  async applyCatalogStructure(structure: CatalogStructureDTO, context?: Context): Promise<CatalogStructureChangesDTO> {
    return this.withTransaction(context, async (transactionContext) => {
      const live = await this.readLive(transactionContext)
      const { categories, collections } = live
      const changes = planCatalogStructureChanges(structure, live)

      await this.productMetafieldDefinitionRepository.upsertByKey(structure.metafields, transactionContext)
      await this.productMetafieldDefinitionRepository.softDelete(
        absentMetafieldDefinitions(structure, live.metafields).map((definition) => definition.id),
        transactionContext,
      )

      const categoryIdOf = new Map(categories.map((category) => [category.handle, category.id]))
      for (const category of flattenStructureCategories(structure.categories)) {
        const fields = {
          name: category.name,
          rule: category.rule,
          isActive: true,
          parentId: category.parentHandle ? (categoryIdOf.get(category.parentHandle) ?? null) : null,
          rank: category.rank,
        }
        const existingId = categoryIdOf.get(category.handle)
        if (existingId) {
          await this.productCategoryService.updateCategory(existingId, fields, transactionContext)
          continue
        }
        const created = await this.productCategoryService.createCategory(
          { ...fields, handle: category.handle },
          transactionContext,
        )
        categoryIdOf.set(category.handle, created.id)
      }

      const collectionIdOf = new Map(collections.map((collection) => [collection.handle, collection.id]))
      for (const collection of structure.collections) {
        const fields = { title: collection.name, rule: collection.rule }
        const existingId = collectionIdOf.get(collection.handle)
        if (existingId) await this.productGroupingService.updateCollection(existingId, fields, transactionContext)
        else {
          await this.productGroupingService.createCollection(
            { ...fields, handle: collection.handle },
            transactionContext,
          )
        }
      }

      for (const level of absentCategoryLevels(structure, categories)) {
        await this.productCategoryService.softDeleteCategories(level, transactionContext)
      }
      const keptCollections = new Set(structure.collections.map((collection) => collection.handle))
      const absentCollectionIds = collections
        .filter((collection) => !keptCollections.has(collection.handle))
        .map((collection) => collection.id)
      if (absentCollectionIds.length > 0) {
        await this.productGroupingService.softDeleteCollections(absentCollectionIds, transactionContext)
      }

      await this.productRuleMembershipService.syncRuleMemberships(undefined, transactionContext)
      return changes
    })
  }

  private async readLive(context?: Context): Promise<LiveCatalogStructure> {
    const [metafields, categories, collections] = await Promise.all([
      this.productMetafieldDefinitionRepository.find(undefined, undefined, context),
      this.productCategoryRepository.find(undefined, undefined, context),
      this.productCollectionRepository.find(undefined, undefined, context),
    ])
    return { metafields, categories, collections }
  }

  /** The whole file as text, or `null` once it passes the size ceiling. */
  private async readText(source: AsyncIterable<Uint8Array | string>): Promise<string | null> {
    const decoder = new TextDecoder()
    let text = ''
    let bytes = 0
    for await (const piece of source) {
      const chunk = typeof piece === 'string' ? new TextEncoder().encode(piece) : piece
      bytes += chunk.byteLength
      if (bytes > MAX_STRUCTURE_FILE_BYTES) return null
      text += decoder.decode(chunk, { stream: true })
    }
    return text + decoder.decode()
  }
}
