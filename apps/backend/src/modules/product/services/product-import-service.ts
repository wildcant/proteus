import { i18n } from '@proteus/utils'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type { Context } from '../../../core/types/context.js'
import type {
  ImportedProductDTO,
  ProductImportDTO,
  ProductImportOutcomeDTO,
  ProductImportPlanDTO,
  ProductImportReferencesDTO,
  ProductImportSettingsDTO,
} from '../../../core/types/product/common.js'
import type { CreateProductImportDTO } from '../../../core/types/product/mutations.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { ProductRepository } from '../repositories/product.js'
import type { ProductCategoryRepository } from '../repositories/product-category.js'
import type { ProductCollectionRepository } from '../repositories/product-collection.js'
import type { ProductImportRepository } from '../repositories/product-import.js'
import type { ProductOptionRepository } from '../repositories/product-option.js'
import type { ProductOptionValueRepository } from '../repositories/product-option-value.js'
import type { ProductTagRepository } from '../repositories/product-tag.js'
import type { ProductTypeRepository } from '../repositories/product-type.js'
import { chunkImportedProducts } from '../utils/shopify-csv/chunk-products.js'
import { parseShopifyCsv } from '../utils/shopify-csv/parse-shopify-csv.js'
import type { ProductCategoryService } from './product-category-service.js'

type InjectedDependencies = {
  productImportRepository: ProductImportRepository
  productRepository: ProductRepository
  productCategoryRepository: ProductCategoryRepository
  productCollectionRepository: ProductCollectionRepository
  productTagRepository: ProductTagRepository
  productTypeRepository: ProductTypeRepository
  productOptionRepository: ProductOptionRepository
  productOptionValueRepository: ProductOptionValueRepository
  withTransaction: WithTransaction
}

/** How long a preview can wait for its confirmation before it expires and its files are deleted. */
const PRODUCT_IMPORT_TTL_MS = 60 * 60 * 1000

/** `mens-sweatshirts` → `Mens sweatshirts`: the name a grouping the file only knows by handle starts with. */
const titleFromHandle = (handle: string) => {
  const words = handle.replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * CSV imports: the job record from preview to finish, and the lookups that turn the names a file
 * uses — handles, values, option titles — into ids.
 *
 * **Internal to the module**, like `ProductCategoryService`: `ProductModuleService` builds it and
 * holds it privately, so the module's public surface stays `IProductModuleService`.
 */
export class ProductImportService {
  private productImportRepository: ProductImportRepository
  private productRepository: ProductRepository
  private productCategoryRepository: ProductCategoryRepository
  private productCollectionRepository: ProductCollectionRepository
  private productTagRepository: ProductTagRepository
  private productTypeRepository: ProductTypeRepository
  private productOptionRepository: ProductOptionRepository
  private productOptionValueRepository: ProductOptionValueRepository
  private productCategoryService: ProductCategoryService
  private withTransaction: WithTransaction

  constructor(dependencies: InjectedDependencies, productCategoryService: ProductCategoryService) {
    this.productImportRepository = dependencies.productImportRepository
    this.productRepository = dependencies.productRepository
    this.productCategoryRepository = dependencies.productCategoryRepository
    this.productCollectionRepository = dependencies.productCollectionRepository
    this.productTagRepository = dependencies.productTagRepository
    this.productTypeRepository = dependencies.productTypeRepository
    this.productOptionRepository = dependencies.productOptionRepository
    this.productOptionValueRepository = dependencies.productOptionValueRepository
    this.withTransaction = dependencies.withTransaction
    this.productCategoryService = productCategoryService
  }

  async planProductImport(
    source: AsyncIterable<Uint8Array | string>,
    settings: ProductImportSettingsDTO,
    context?: Context,
  ): Promise<ProductImportPlanDTO> {
    const { products, errors, ignoredColumns } = await parseShopifyCsv(source, settings)

    const handlesOf = (pick: (product: ImportedProductDTO) => string[]) => [...new Set(products.flatMap(pick))]
    const productHandles = handlesOf((product) => [product.handle])
    const categoryHandles = handlesOf((product) => product.categoryHandles)
    const collectionHandles = handlesOf((product) => product.collectionHandles)
    const tagValues = handlesOf((product) => product.tags)
    const typeValues = handlesOf((product) => (product.type ? [product.type] : []))

    const [existingProducts, categories, collections, tags, types] = await Promise.all([
      this.findIfAny(productHandles, (handle) => this.productRepository.find({ handle }, undefined, context)),
      this.findIfAny(categoryHandles, (handle) => this.productCategoryRepository.find({ handle }, undefined, context)),
      this.findIfAny(collectionHandles, (handle) =>
        this.productCollectionRepository.find({ handle }, undefined, context),
      ),
      this.findIfAny(tagValues, (value) => this.productTagRepository.find({ value }, undefined, context)),
      this.findIfAny(typeValues, (value) => this.productTypeRepository.find({ value }, undefined, context)),
    ])

    const existing = new Set(existingProducts.map((product) => product.handle))
    const missing = (wanted: string[], found: string[]) => wanted.filter((entry) => !found.includes(entry))
    const update = products.filter((product) => existing.has(product.handle)).length

    return {
      summary: {
        products: {
          create: products.length - update,
          update: settings.overwrite ? update : 0,
          skip: settings.overwrite ? 0 : update,
        },
        skus: products.reduce((total, product) => total + product.variants.length, 0),
        images: products.reduce((total, product) => total + product.imageUrls.length, 0),
        willCreate: {
          categories: missing(
            categoryHandles,
            categories.map((category) => category.handle),
          ),
          collections: missing(
            collectionHandles,
            collections.map((collection) => collection.handle),
          ),
          tags: missing(
            tagValues,
            tags.map((tag) => tag.value),
          ),
          types: missing(
            typeValues,
            types.map((type) => type.value),
          ),
        },
        ignoredColumns,
        firstProduct: products[0] ?? null,
      },
      errors,
      // A plan that cannot run has nothing to store.
      chunks: errors.length > 0 ? [] : chunkImportedProducts(products),
    }
  }

  async createProductImport(data: CreateProductImportDTO, context?: Context): Promise<ProductImportDTO> {
    return this.withTransaction(context, (ctx) =>
      this.productImportRepository.create({ ...data, status: 'previewed' }, ctx),
    )
  }

  async retrieveProductImport(id: string, context?: Context): Promise<ProductImportDTO> {
    return this.productImportRepository.findByIdOrFail(id, undefined, context)
  }

  /** Refused unless the job is a clean preview young enough to still have its files. */
  async confirmProductImport(id: string, context?: Context): Promise<ProductImportDTO> {
    return this.withTransaction(context, async (ctx) => {
      const job = await this.productImportRepository.findByIdOrFail(id, undefined, ctx)
      this.assertPreviewed(job)
      if (job.errors.length > 0) {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: i18n.t('This import has errors. Fix the file and upload it again.'),
        })
      }
      if (job.createdAt.getTime() < Date.now() - PRODUCT_IMPORT_TTL_MS) {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: i18n.t('This import has expired. Upload the file again.'),
        })
      }
      return this.productImportRepository.update(id, { status: 'importing' }, ctx)
    })
  }

  async cancelProductImport(id: string, context?: Context): Promise<ProductImportDTO> {
    return this.withTransaction(context, async (ctx) => {
      const job = await this.productImportRepository.findByIdOrFail(id, undefined, ctx)
      this.assertPreviewed(job)
      return this.productImportRepository.update(id, { status: 'canceled' }, ctx)
    })
  }

  async expireProductImports(context?: Context): Promise<ProductImportDTO[]> {
    return this.withTransaction(context, (ctx) =>
      this.productImportRepository.expirePreviewedBefore(new Date(Date.now() - PRODUCT_IMPORT_TTL_MS), ctx),
    )
  }

  async recordProductImportOutcome(id: string, outcome: ProductImportOutcomeDTO, context?: Context): Promise<void> {
    return this.withTransaction(context, (ctx) => this.productImportRepository.recordOutcome(id, outcome, ctx))
  }

  /** `failed` when nothing made it in; a job already finished is returned as it is. */
  async finishProductImport(id: string, context?: Context): Promise<ProductImportDTO> {
    return this.withTransaction(context, async (ctx) => {
      const job = await this.productImportRepository.findByIdOrFail(id, undefined, ctx)
      if (job.status !== 'importing') return job
      const nothingImported = job.created + job.updated + job.skipped === 0 && job.failed > 0
      return this.productImportRepository.update(id, { status: nothingImported ? 'failed' : 'completed' }, ctx)
    })
  }

  /**
   * Finds what the product's names refer to and creates what is missing, in one transaction.
   *
   * New Categories go at the root and inactive: the file says a product is in `mens-sweatshirts` but
   * not where that sits in the tree, so the merchant places it and turns it on from the Organize page.
   */
  async resolveProductImportReferences(
    product: ImportedProductDTO,
    context?: Context,
  ): Promise<ProductImportReferencesDTO> {
    return this.withTransaction(context, async (ctx) => {
      const [existing] = await this.productRepository.find({ handle: product.handle }, undefined, ctx)

      const typeId = product.type
        ? ((
            await this.findOrCreate(
              [product.type],
              (value) => this.productTypeRepository.find({ value }, undefined, ctx),
              (type) => type.value,
              (values) =>
                this.productTypeRepository.createMany(
                  values.map((value) => ({ value })),
                  ctx,
                ),
            )
          )[0] ?? null)
        : null

      const categoryIds = await this.findOrCreate(
        product.categoryHandles,
        (handle) => this.productCategoryRepository.find({ handle }, undefined, ctx),
        (category) => category.handle,
        (handles) =>
          Promise.all(
            handles.map((handle) =>
              this.productCategoryService.createCategory(
                { name: titleFromHandle(handle), handle, parentId: null, isActive: false },
                ctx,
              ),
            ),
          ),
      )
      const collectionIds = await this.findOrCreate(
        product.collectionHandles,
        (handle) => this.productCollectionRepository.find({ handle }, undefined, ctx),
        (collection) => collection.handle,
        (handles) =>
          this.productCollectionRepository.createMany(
            handles.map((handle) => ({ title: titleFromHandle(handle), handle })),
            ctx,
          ),
      )
      const tagIds = await this.findOrCreate(
        product.tags,
        (value) => this.productTagRepository.find({ value }, undefined, ctx),
        (tag) => tag.value,
        (values) =>
          this.productTagRepository.createMany(
            values.map((value) => ({ value })),
            ctx,
          ),
      )

      const optionIds = await this.findOrCreate(
        product.options.map((option) => option.title),
        (title) => this.productOptionRepository.find({ title }, undefined, ctx),
        (option) => option.title,
        (titles) =>
          this.productOptionRepository.createMany(
            titles.map((title) => ({ title })),
            ctx,
          ),
      )
      const options = await Promise.all(
        product.options.map(async (option, index) => {
          const optionId = optionIds[index] ?? ''
          const valueIds = await this.findOrCreate(
            option.values,
            (value) => this.productOptionValueRepository.find({ optionId, value }, undefined, ctx),
            (row) => row.value,
            (values) =>
              this.productOptionValueRepository.createMany(
                values.map((value) => ({ optionId, value })),
                ctx,
              ),
          )
          return { optionId, valueIds }
        }),
      )

      return { existingProductId: existing?.id ?? null, typeId, categoryIds, collectionIds, tagIds, options }
    })
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private async findIfAny<T>(keys: string[], find: (keys: string[]) => Promise<T[]>): Promise<T[]> {
    return keys.length > 0 ? find(keys) : []
  }

  /** The id of the row each key names, in the order of `keys`, creating the rows no key found. */
  private async findOrCreate<T extends { id: string }>(
    keys: string[],
    find: (keys: string[]) => Promise<T[]>,
    keyOf: (row: T) => string,
    create: (keys: string[]) => Promise<T[]>,
  ): Promise<string[]> {
    if (keys.length === 0) return []
    const found = await find(keys)
    const missing = keys.filter((key) => !found.some((row) => keyOf(row) === key))
    const created = missing.length > 0 ? await create(missing) : []
    const idByKey = new Map([...found, ...created].map((row) => [keyOf(row), row.id]))
    return keys.flatMap((key) => {
      const id = idByKey.get(key)
      return id ? [id] : []
    })
  }

  private assertPreviewed(job: ProductImportDTO): void {
    if (job.status === 'previewed') return
    throw new AppError({
      type: ErrorTypes.NOT_ALLOWED,
      message: i18n.t('Only an import waiting in preview can be confirmed or canceled.'),
    })
  }
}
