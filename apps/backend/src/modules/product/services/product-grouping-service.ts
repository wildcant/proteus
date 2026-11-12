import { i18n } from '@proteus/utils'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type { FindConfig } from '../../../core/types/common.js'
import type { Context } from '../../../core/types/context.js'
import type {
  FilterableProductCollectionProps,
  FilterableProductTagProps,
  FilterableProductTypeProps,
  ProductCollectionDTO,
  ProductTagDTO,
  ProductTypeDTO,
} from '../../../core/types/product/common.js'
import type {
  CreateProductCollectionDTO,
  CreateProductTagDTO,
  CreateProductTypeDTO,
  SetCollectionProductsDTO,
  UpdateProductCollectionDTO,
  UpdateProductTagDTO,
  UpdateProductTypeDTO,
} from '../../../core/types/product/mutations.js'
import { toHandle } from '../../../core/utils/to-handle.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { ProductCollectionRepository } from '../repositories/product-collection.js'
import type { ProductProductCollectionRepository } from '../repositories/product-product-collection.js'
import type { ProductTagRepository } from '../repositories/product-tag.js'
import type { ProductTypeRepository } from '../repositories/product-type.js'

type InjectedDependencies = {
  productCollectionRepository: ProductCollectionRepository
  productProductCollectionRepository: ProductProductCollectionRepository
  productTagRepository: ProductTagRepository
  productTypeRepository: ProductTypeRepository
  withTransaction: WithTransaction
}

/**
 * The flat groupings — Collections, and the same CRUD again for tags and types. Each is a list of
 * rows with none of the Category tree's shape or rank. A product's memberships are pivot rows, read
 * and written by `ProductGroupingPivotRepository`; only the Collection's merchandising side starts here.
 *
 * **Internal to the module**, like `ProductCategoryService`: `ProductModuleService` builds it and
 * holds it privately, so the module's public surface stays `IProductModuleService`.
 *
 * Deleting needs no code here: the pivots cascade from the Collection and the Tag, so the derived
 * soft-delete cascade hides their memberships and leaves the products alone. A Product Type sits outside the
 * cascade (`product.type_id` is `set null`), so its products keep the id and read no Type.
 */
export class ProductGroupingService {
  private productCollectionRepository: ProductCollectionRepository
  private productProductCollectionRepository: ProductProductCollectionRepository
  private productTagRepository: ProductTagRepository
  private productTypeRepository: ProductTypeRepository
  private withTransaction: WithTransaction

  constructor({
    productCollectionRepository,
    productProductCollectionRepository,
    productTagRepository,
    productTypeRepository,
    withTransaction,
  }: InjectedDependencies) {
    this.productCollectionRepository = productCollectionRepository
    this.productProductCollectionRepository = productProductCollectionRepository
    this.productTagRepository = productTagRepository
    this.productTypeRepository = productTypeRepository
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
    return this.withTransaction(context, async (transactionContext) =>
      this.productCollectionRepository.create(
        { ...data, handle: data.handle ?? toHandle(data.title) },
        transactionContext,
      ),
    )
  }

  async updateCollection(
    collectionId: string,
    data: UpdateProductCollectionDTO,
    context?: Context,
  ): Promise<ProductCollectionDTO> {
    return this.withTransaction(context, async (transactionContext) => {
      if (Object.values(data).every((value) => value === undefined)) {
        return this.productCollectionRepository.findByIdOrFail(collectionId, undefined, transactionContext)
      }
      return this.productCollectionRepository.update(collectionId, data, transactionContext)
    })
  }

  async softDeleteCollections(collectionIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (transactionContext) =>
      this.productCollectionRepository.softDelete(collectionIds, transactionContext),
    )
  }

  /**
   * Adds then removes members. A product already in is left alone, and so is one asked to leave
   * that was never in. Joining this Collection never takes a product out of another (ADR 0032). An
   * unknown product id is a foreign-key violation, answered `NOT_FOUND`. A ruled Collection is
   * refused with `NOT_ALLOWED`: its rule alone decides the members.
   */
  async setCollectionProducts(
    collectionId: string,
    data: SetCollectionProductsDTO,
    context?: Context,
  ): Promise<ProductCollectionDTO> {
    return this.withTransaction(context, async (transactionContext) => {
      const collection = await this.productCollectionRepository.findByIdOrFail(
        collectionId,
        undefined,
        transactionContext,
      )
      if (collection.rule) {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: i18n.t("This collection's products follow its rule. Change the rule or the products' metafields."),
        })
      }
      await this.productProductCollectionRepository.setProducts(collectionId, data, transactionContext)
      return collection
    })
  }

  // ── Product Types ──────────────────────────────────────────────────────

  async listAndCountTypes(
    filters?: FilterableProductTypeProps,
    config?: FindConfig<ProductTypeDTO>,
    context?: Context,
  ): Promise<[ProductTypeDTO[], number]> {
    return this.productTypeRepository.findAndCount(filters, config, context)
  }

  async retrieveType(typeId: string, context?: Context): Promise<ProductTypeDTO> {
    return this.productTypeRepository.findByIdOrFail(typeId, undefined, context)
  }

  async createType(data: CreateProductTypeDTO, context?: Context): Promise<ProductTypeDTO> {
    return this.withTransaction(context, async (transactionContext) =>
      this.productTypeRepository.create(data, transactionContext),
    )
  }

  async updateType(typeId: string, data: UpdateProductTypeDTO, context?: Context): Promise<ProductTypeDTO> {
    return this.withTransaction(context, async (transactionContext) => {
      if (data.value === undefined)
        return this.productTypeRepository.findByIdOrFail(typeId, undefined, transactionContext)
      return this.productTypeRepository.update(typeId, data, transactionContext)
    })
  }

  async softDeleteTypes(typeIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (transactionContext) =>
      this.productTypeRepository.softDelete(typeIds, transactionContext),
    )
  }

  // ── Product Tags ───────────────────────────────────────────────────────

  async listAndCountTags(
    filters?: FilterableProductTagProps,
    config?: FindConfig<ProductTagDTO>,
    context?: Context,
  ): Promise<[ProductTagDTO[], number]> {
    return this.productTagRepository.findAndCount(filters, config, context)
  }

  async retrieveTag(tagId: string, context?: Context): Promise<ProductTagDTO> {
    return this.productTagRepository.findByIdOrFail(tagId, undefined, context)
  }

  async createTag(data: CreateProductTagDTO, context?: Context): Promise<ProductTagDTO> {
    return this.withTransaction(context, async (transactionContext) =>
      this.productTagRepository.create(data, transactionContext),
    )
  }

  async updateTag(tagId: string, data: UpdateProductTagDTO, context?: Context): Promise<ProductTagDTO> {
    return this.withTransaction(context, async (transactionContext) => {
      if (data.value === undefined)
        return this.productTagRepository.findByIdOrFail(tagId, undefined, transactionContext)
      return this.productTagRepository.update(tagId, data, transactionContext)
    })
  }

  async softDeleteTags(tagIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (transactionContext) =>
      this.productTagRepository.softDelete(tagIds, transactionContext),
    )
  }
}
