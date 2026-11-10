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

  /**
   * The Rank rule: read the live siblings by `(rank, id)`, insert the new Category at
   * `min(rank, sibling count)` — appended when no rank is given — then write `rank = position` for
   * the whole set. Duplicates and gaps left by anything else heal here.
   */
  async createCategory(data: CreateProductCategoryDTO, context?: Context): Promise<ProductCategoryDTO> {
    const { rank, ...categoryData } = data
    const parentId = data.parentId ?? null
    return this.withTransaction(context, async (ctx) => {
      if (parentId) await this.productCategoryRepository.findByIdOrFail(parentId, undefined, ctx)

      const siblings = await this.productCategoryRepository.find(
        { parentId },
        { select: ['id'], order: { rank: 'ASC', id: 'ASC' } },
        ctx,
      )
      const created = await this.productCategoryRepository.create(
        { ...categoryData, parentId, handle: data.handle ?? toHandle(data.name) },
        ctx,
      )

      const orderedIds = siblings.map((sibling) => sibling.id)
      orderedIds.splice(Math.min(rank ?? orderedIds.length, orderedIds.length), 0, created.id)
      await this.productCategoryRepository.renumber(orderedIds, ctx)

      return this.productCategoryRepository.findByIdOrFail(created.id, undefined, ctx)
    })
  }

  async updateCategory(
    categoryId: string,
    data: UpdateProductCategoryDTO,
    context?: Context,
  ): Promise<ProductCategoryDTO> {
    return this.withTransaction(context, async (ctx) =>
      Object.values(data).some((value) => value !== undefined)
        ? this.productCategoryRepository.update(categoryId, data, ctx)
        : this.productCategoryRepository.findByIdOrFail(categoryId, undefined, ctx),
    )
  }

  async softDeleteCategories(categoryIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => this.productCategoryRepository.softDelete(categoryIds, ctx))
  }
}
