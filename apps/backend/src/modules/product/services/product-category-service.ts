import { i18n } from '@proteus/utils'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type { Context } from '../../../core/types/context.js'
import type { ProductCategoryDTO, ProductCategoryTreeNodeDTO } from '../../../core/types/product/common.js'
import type { CreateProductCategoryDTO, UpdateProductCategoryDTO } from '../../../core/types/product/mutations.js'
import { toHandle } from '../../../core/utils/to-handle.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { ProductCategoryRepository } from '../repositories/product-category.js'

type InjectedDependencies = {
  productCategoryRepository: ProductCategoryRepository
  withTransaction: WithTransaction
}

/**
 * The Category tree: its shape, and the rank of each Category among its siblings.
 *
 * **Internal to the module**, like `ProductOptionService`: `ProductModuleService` builds it and
 * holds it privately, so the module's public surface stays `IProductModuleService`.
 *
 * Deleting needs no code here. `parent_id` is `on delete restrict`, so the derived soft-delete
 * cascade refuses a Category that still has live children with `NOT_ALLOWED`.
 */
export class ProductCategoryService {
  private productCategoryRepository: ProductCategoryRepository
  private withTransaction: WithTransaction

  constructor({ productCategoryRepository, withTransaction }: InjectedDependencies) {
    this.productCategoryRepository = productCategoryRepository
    this.withTransaction = withTransaction
  }

  async listCategoryTree(context?: Context): Promise<ProductCategoryTreeNodeDTO[]> {
    const categories = await this.productCategoryRepository.find(
      undefined,
      { order: { rank: 'ASC', id: 'ASC' } },
      context,
    )

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

  async retrieveCategory(categoryId: string, context?: Context): Promise<ProductCategoryDTO> {
    return this.productCategoryRepository.findByIdOrFail(categoryId, undefined, context)
  }

  async createCategory(data: CreateProductCategoryDTO, context?: Context): Promise<ProductCategoryDTO> {
    const { rank, ...categoryData } = data
    const parentId = data.parentId ?? null
    return this.withTransaction(context, async (ctx) => {
      if (parentId) await this.productCategoryRepository.findByIdOrFail(parentId, undefined, ctx)
      const created = await this.productCategoryRepository.create(
        { ...categoryData, parentId, handle: data.handle ?? toHandle(data.name) },
        ctx,
      )
      await this.place(created.id, parentId, rank, ctx)
      return this.productCategoryRepository.findByIdOrFail(created.id, undefined, ctx)
    })
  }

  /**
   * Moves and reorders as well as edits: a `parentId` or a `rank` places the Category by the Rank
   * rule. No lock is taken — of two concurrent reorders the last write wins, and whatever duplicate
   * or gap it leaves heals on the next write in that sibling set.
   */
  async updateCategory(
    categoryId: string,
    data: UpdateProductCategoryDTO,
    context?: Context,
  ): Promise<ProductCategoryDTO> {
    const { parentId, rank, ...fields } = data
    return this.withTransaction(context, async (ctx) => {
      const category = await this.productCategoryRepository.findByIdOrFail(categoryId, undefined, ctx)
      if (Object.values(fields).some((value) => value !== undefined)) {
        await this.productCategoryRepository.update(categoryId, fields, ctx)
      }
      if (parentId === undefined && rank === undefined) {
        return this.productCategoryRepository.findByIdOrFail(categoryId, undefined, ctx)
      }

      const targetParentId = parentId === undefined ? category.parentId : parentId
      if (targetParentId) await this.assertParentOutsideSubtree(categoryId, targetParentId, ctx)
      if (targetParentId !== category.parentId) {
        await this.productCategoryRepository.update(categoryId, { parentId: targetParentId }, ctx)
      }
      await this.place(categoryId, targetParentId, rank, ctx)
      return this.productCategoryRepository.findByIdOrFail(categoryId, undefined, ctx)
    })
  }

  async softDeleteCategories(categoryIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => this.productCategoryRepository.softDelete(categoryIds, ctx))
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
}
