import type { FindConfig } from '../../../core/types/common.js'
import type { Context } from '../../../core/types/context.js'
import type { FilterableProductCollectionProps, ProductCollectionDTO } from '../../../core/types/product/common.js'
import type {
  CreateProductCollectionDTO,
  SetCollectionProductsDTO,
  UpdateProductCollectionDTO,
} from '../../../core/types/product/mutations.js'
import { toHandle } from '../../../core/utils/to-handle.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { ProductCollectionRepository } from '../repositories/product-collection.js'
import type { ProductProductCollectionRepository } from '../repositories/product-product-collection.js'

type InjectedDependencies = {
  productCollectionRepository: ProductCollectionRepository
  productProductCollectionRepository: ProductProductCollectionRepository
  withTransaction: WithTransaction
}

/**
 * The flat groupings — Collections, and the same CRUD again for tags and types. Each is a list of
 * rows joined to products through a pivot, with none of the Category tree's shape or rank.
 *
 * **Internal to the module**, like `ProductCategoryService`: `ProductModuleService` builds it and
 * holds it privately, so the module's public surface stays `IProductModuleService`.
 *
 * Deleting needs no code here: the pivot cascades from the Collection, so the derived soft-delete
 * cascade hides its memberships and leaves the products alone.
 */
export class ProductGroupingService {
  private productCollectionRepository: ProductCollectionRepository
  private productProductCollectionRepository: ProductProductCollectionRepository
  private withTransaction: WithTransaction

  constructor({
    productCollectionRepository,
    productProductCollectionRepository,
    withTransaction,
  }: InjectedDependencies) {
    this.productCollectionRepository = productCollectionRepository
    this.productProductCollectionRepository = productProductCollectionRepository
    this.withTransaction = withTransaction
  }

  // ── Collections ────────────────────────────────────────────────────────

  async listAndCountCollections(
    filters?: FilterableProductCollectionProps,
    config?: FindConfig<ProductCollectionDTO>,
    context?: Context,
  ): Promise<[ProductCollectionDTO[], number]> {
    return this.productCollectionRepository.findAndCount(filters, config, context)
  }

  async retrieveCollection(collectionId: string, context?: Context): Promise<ProductCollectionDTO> {
    return this.productCollectionRepository.findByIdOrFail(collectionId, undefined, context)
  }

  async createCollection(data: CreateProductCollectionDTO, context?: Context): Promise<ProductCollectionDTO> {
    return this.withTransaction(context, async (ctx) =>
      this.productCollectionRepository.create({ ...data, handle: data.handle ?? toHandle(data.title) }, ctx),
    )
  }

  async updateCollection(
    collectionId: string,
    data: UpdateProductCollectionDTO,
    context?: Context,
  ): Promise<ProductCollectionDTO> {
    return this.withTransaction(context, async (ctx) => {
      if (Object.values(data).every((value) => value === undefined)) {
        return this.productCollectionRepository.findByIdOrFail(collectionId, undefined, ctx)
      }
      return this.productCollectionRepository.update(collectionId, data, ctx)
    })
  }

  async softDeleteCollections(collectionIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => this.productCollectionRepository.softDelete(collectionIds, ctx))
  }

  /**
   * Adds then removes members. A product already in is left alone, and so is one asked to leave
   * that was never in. Joining this Collection never takes a product out of another (ADR 0032). An
   * unknown product id is a foreign-key violation, answered `NOT_FOUND`.
   */
  async setCollectionProducts(
    collectionId: string,
    { add = [], remove = [] }: SetCollectionProductsDTO,
    context?: Context,
  ): Promise<ProductCollectionDTO> {
    return this.withTransaction(context, async (ctx) => {
      const collection = await this.productCollectionRepository.findByIdOrFail(collectionId, undefined, ctx)

      const toAdd = [...new Set(add)]
      if (toAdd.length > 0) {
        const members = await this.productProductCollectionRepository.find(
          { collectionId, productId: toAdd },
          { select: ['productId'] },
          ctx,
        )
        const memberIds = new Set(members.map((member) => member.productId))
        await this.productProductCollectionRepository.createMany(
          toAdd.filter((productId) => !memberIds.has(productId)).map((productId) => ({ productId, collectionId })),
          ctx,
        )
      }

      if (remove.length > 0) {
        const leaving = await this.productProductCollectionRepository.find(
          { collectionId, productId: remove },
          { select: ['id'] },
          ctx,
        )
        await this.productProductCollectionRepository.softDelete(
          leaving.map((row) => row.id),
          ctx,
        )
      }

      return collection
    })
  }

  /**
   * Makes `collectionIds` the product's whole set: soft-deletes the rows it drops, keeps the rest and
   * creates the new ones — the same diff the product's options use.
   */
  async replaceProductCollections(productId: string, collectionIds: string[], context: Context): Promise<void> {
    const wanted = new Set(collectionIds)
    const existing = await this.productProductCollectionRepository.find({ productId }, undefined, context)
    const existingIds = new Set(existing.map((row) => row.collectionId))

    await this.productProductCollectionRepository.softDelete(
      existing.filter((row) => !wanted.has(row.collectionId)).map((row) => row.id),
      context,
    )
    await this.productProductCollectionRepository.createMany(
      [...wanted]
        .filter((collectionId) => !existingIds.has(collectionId))
        .map((collectionId) => ({ productId, collectionId })),
      context,
    )
  }

  /** Every product's live Collections, by title, in one query. A product in none maps to `[]`. */
  async listCollectionsOfProducts(
    productIds: string[],
    context?: Context,
  ): Promise<Map<string, ProductCollectionDTO[]>> {
    const rows = await this.productProductCollectionRepository.findCollectionsOfProducts(productIds, context)
    const byProduct = new Map<string, ProductCollectionDTO[]>(productIds.map((productId) => [productId, []]))
    for (const { productId, collection } of rows) byProduct.get(productId)?.push(collection)
    return byProduct
  }
}
