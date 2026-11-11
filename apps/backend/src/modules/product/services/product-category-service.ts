import { i18n } from '@proteus/utils'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type { Context } from '../../../core/types/context.js'
import type {
  FilterableProductCategoryProps,
  ListCategoryTreeDTO,
  ProductCategoryDTO,
  ProductCategoryTreeNodeDTO,
} from '../../../core/types/product/common.js'
import type {
  CreateProductCategoryDTO,
  SetCategoryProductsDTO,
  UpdateProductCategoryDTO,
} from '../../../core/types/product/mutations.js'
import { toHandle } from '../../../core/utils/to-handle.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { ProductCategoryRepository } from '../repositories/product-category.js'
import type { ProductProductCategoryRepository } from '../repositories/product-product-category.js'

type InjectedDependencies = {
  productCategoryRepository: ProductCategoryRepository
  productProductCategoryRepository: ProductProductCategoryRepository
  withTransaction: WithTransaction
}

/**
 * The Category tree: its shape, and the rank of each Category among its siblings.
 *
 * **Internal to the module**, like `ProductOptionService`: `ProductModuleService` builds it and
 * holds it privately, so the module's public surface stays `IProductModuleService`.
 *
 * `parent_id` is `on delete restrict`, so the derived soft-delete cascade already refuses a Category
 * that still has live children with `NOT_ALLOWED`. `softDeleteCategories` asks first only to say so
 * in the merchant's words: the walker's refusal names the foreign key, and the admin shows the
 * message as it comes. Product Options ask the same way.
 */
export class ProductCategoryService {
  private productCategoryRepository: ProductCategoryRepository
  private productProductCategoryRepository: ProductProductCategoryRepository
  private withTransaction: WithTransaction

  constructor({ productCategoryRepository, productProductCategoryRepository, withTransaction }: InjectedDependencies) {
    this.productCategoryRepository = productCategoryRepository
    this.productProductCategoryRepository = productProductCategoryRepository
    this.withTransaction = withTransaction
  }

  /** `visibleOnly` is the store's tree: a hidden Category is left out together with its subtree. */
  async listCategoryTree(
    { visibleOnly = false }: ListCategoryTreeDTO = {},
    context?: Context,
  ): Promise<ProductCategoryTreeNodeDTO[]> {
    const categories = visibleOnly
      ? await this.productCategoryRepository.findVisible(context)
      : await this.productCategoryRepository.find(undefined, { order: { rank: 'ASC', id: 'ASC' } }, context)

    const nodes = new Map<string, ProductCategoryTreeNodeDTO>(
      categories.map((category) => [category.id, { ...category, children: [] }]),
    )
    const roots: ProductCategoryTreeNodeDTO[] = []
    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined
      if (parent) parent.children.push(node)
      else if (!node.parentId) roots.push(node)
    }
    return roots
  }

  async listCategories(filters?: FilterableProductCategoryProps, context?: Context): Promise<ProductCategoryDTO[]> {
    return this.productCategoryRepository.find(filters, { order: { rank: 'ASC', id: 'ASC' } }, context)
  }

  async retrieveCategory(categoryId: string, context?: Context): Promise<ProductCategoryDTO> {
    return this.productCategoryRepository.findByIdOrFail(categoryId, undefined, context)
  }

  async createCategory(data: CreateProductCategoryDTO, context?: Context): Promise<ProductCategoryDTO> {
    const { rank, ...categoryData } = data
    const parentId = data.parentId ?? null
    return this.withTransaction(context, async (transactionContext) => {
      if (parentId) await this.productCategoryRepository.findByIdOrFail(parentId, undefined, transactionContext)
      const created = await this.productCategoryRepository.create(
        { ...categoryData, parentId, handle: data.handle ?? toHandle(data.name) },
        transactionContext,
      )
      await this.place(created.id, parentId, rank, transactionContext)
      return this.productCategoryRepository.findByIdOrFail(created.id, undefined, transactionContext)
    })
  }

  /**
   * Moves and reorders as well as edits: a new `parentId` or a `rank` places the Category by the Rank
   * rule. Naming the parent it already has is no move, so without a rank it keeps its place. No lock
   * is taken — of two concurrent reorders the last write wins, and whatever duplicate or gap it
   * leaves heals on the next write in that sibling set.
   */
  async updateCategory(
    categoryId: string,
    data: UpdateProductCategoryDTO,
    context?: Context,
  ): Promise<ProductCategoryDTO> {
    const { parentId, rank, ...fields } = data
    return this.withTransaction(context, async (transactionContext) => {
      const category = await this.productCategoryRepository.findByIdOrFail(categoryId, undefined, transactionContext)
      if (Object.values(fields).some((value) => value !== undefined)) {
        await this.productCategoryRepository.update(categoryId, fields, transactionContext)
      }
      const targetParentId = parentId === undefined ? category.parentId : parentId
      const moves = targetParentId !== category.parentId
      if (!moves && rank === undefined) {
        return this.productCategoryRepository.findByIdOrFail(categoryId, undefined, transactionContext)
      }

      if (moves) {
        if (targetParentId) await this.assertParentOutsideSubtree(categoryId, targetParentId, transactionContext)
        await this.productCategoryRepository.update(categoryId, { parentId: targetParentId }, transactionContext)
      }
      await this.place(categoryId, targetParentId, rank, transactionContext)
      return this.productCategoryRepository.findByIdOrFail(categoryId, undefined, transactionContext)
    })
  }

  async softDeleteCategories(categoryIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (transactionContext) => {
      const child = await this.productCategoryRepository.findOne(
        { parentId: categoryIds },
        { select: ['id'] },
        transactionContext,
      )
      if (child) {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: i18n.t('A category with subcategories cannot be deleted. Delete or move its subcategories first.'),
        })
      }
      await this.productCategoryRepository.softDelete(categoryIds, transactionContext)
    })
  }

  /** The parent must exist, and must not be the Category itself or below it — that would cut the subtree loose. */
  private async assertParentOutsideSubtree(categoryId: string, parentId: string, context: Context): Promise<void> {
    await this.productCategoryRepository.findByIdOrFail(parentId, undefined, context)
    if (!(await this.productCategoryRepository.isInSubtree(categoryId, parentId, context))) return
    throw new AppError({
      type: ErrorTypes.INVALID_ARGUMENT,
      message: i18n.t('A category cannot be moved under itself or one of its subcategories'),
    })
  }

  /**
   * The Rank rule: read the live siblings by `(rank, id)`, leaving out the Category being placed;
   * insert it at `min(rank, sibling count)` — appended when no rank is given — then write
   * `rank = position` for the whole set. Duplicates and gaps left by anything else heal here.
   */
  private async place(
    categoryId: string,
    parentId: string | null,
    rank: number | undefined,
    context: Context,
  ): Promise<void> {
    const siblings = await this.productCategoryRepository.find(
      { parentId, id: { $ne: categoryId } },
      { select: ['id'], order: { rank: 'ASC', id: 'ASC' } },
      context,
    )
    const orderedIds = siblings.map((sibling) => sibling.id)
    orderedIds.splice(Math.min(rank ?? orderedIds.length, orderedIds.length), 0, categoryId)
    await this.productCategoryRepository.renumber(orderedIds, context)
  }

  // ── Membership ─────────────────────────────────────────────────────────

  /**
   * Adds then removes direct members. A product already in is left alone, and so is one asked to
   * leave that was never in. An unknown product id is a foreign-key violation, answered `NOT_FOUND`.
   * A ruled Category is refused with `NOT_ALLOWED`: its rule alone decides the members.
   */
  async setCategoryProducts(
    categoryId: string,
    data: SetCategoryProductsDTO,
    context?: Context,
  ): Promise<ProductCategoryDTO> {
    return this.withTransaction(context, async (transactionContext) => {
      const category = await this.productCategoryRepository.findByIdOrFail(categoryId, undefined, transactionContext)
      if (category.rule) {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: i18n.t("This category's products follow its tag rule. Change the rule or the products' tags."),
        })
      }
      await this.productProductCategoryRepository.setProducts(categoryId, data, transactionContext)
      return category
    })
  }
}
