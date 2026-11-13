import type { Context } from '../../../core/types/context.js'
import type { ProductGroupingRuleDTO } from '../../../core/types/product/common.js'
import type { SyncRuleMembershipsDTO } from '../../../core/types/product/mutations.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { ProductRepository } from '../repositories/product.js'
import type { ProductCategoryRepository } from '../repositories/product-category.js'
import type { ProductCollectionRepository } from '../repositories/product-collection.js'
import type { ProductMetafieldRepository } from '../repositories/product-metafield.js'
import type { ProductMetafieldDefinitionRepository } from '../repositories/product-metafield-definition.js'
import type { ProductProductCategoryRepository } from '../repositories/product-product-category.js'
import type { ProductProductCollectionRepository } from '../repositories/product-product-collection.js'
import { matchesGroupingRule } from '../utils/grouping-rule.js'

type InjectedDependencies = {
  productRepository: ProductRepository
  productCategoryRepository: ProductCategoryRepository
  productCollectionRepository: ProductCollectionRepository
  productProductCategoryRepository: ProductProductCategoryRepository
  productProductCollectionRepository: ProductProductCollectionRepository
  productMetafieldRepository: ProductMetafieldRepository
  productMetafieldDefinitionRepository: ProductMetafieldDefinitionRepository
  withTransaction: WithTransaction
}

/** Each scoped product's field values by key, and which keys match ignoring case: the brand's and the type's. */
type ProductFacts = { fieldsOf: Map<string, Map<string, Set<string>>>; caseInsensitiveKeys: ReadonlySet<string> }

type RuledGrouping = { id: string; rule: ProductGroupingRuleDTO | null }

/** What the Category and Collection pivots have in common, as far as syncing reads and writes them. */
type MembershipPivot = {
  findGroupingsOfProducts(productIds: string[], context?: Context): Promise<Map<string, { id: string }[]>>
  setProducts(groupingId: string, data: { add?: string[]; remove?: string[] }, context?: Context): Promise<void>
}

/**
 * Keeps ruled Categories and Collections holding exactly the products their rule matches on their
 * fields: metafields, and the brand under the vendor field's key.
 *
 * **Internal to the module**, like `ProductCategoryService`. `ProductModuleService` calls it inside
 * the transaction of every write that can change a match: a product's metafields, brand or groupings, a
 * grouping's rule, a structure file. A manual grouping (`rule` null) is never touched, so clearing a rule leaves the
 * members it had as picked ones.
 */
export class ProductRuleMembershipService {
  private productRepository: ProductRepository
  private productCategoryRepository: ProductCategoryRepository
  private productCollectionRepository: ProductCollectionRepository
  private productProductCategoryRepository: ProductProductCategoryRepository
  private productProductCollectionRepository: ProductProductCollectionRepository
  private productMetafieldRepository: ProductMetafieldRepository
  private productMetafieldDefinitionRepository: ProductMetafieldDefinitionRepository
  private withTransaction: WithTransaction

  constructor(dependencies: InjectedDependencies) {
    this.productRepository = dependencies.productRepository
    this.productCategoryRepository = dependencies.productCategoryRepository
    this.productCollectionRepository = dependencies.productCollectionRepository
    this.productProductCategoryRepository = dependencies.productProductCategoryRepository
    this.productProductCollectionRepository = dependencies.productProductCollectionRepository
    this.productMetafieldRepository = dependencies.productMetafieldRepository
    this.productMetafieldDefinitionRepository = dependencies.productMetafieldDefinitionRepository
    this.withTransaction = dependencies.withTransaction
  }

  async syncRuleMemberships(
    { productIds, categoryIds, collectionIds }: SyncRuleMembershipsDTO = {},
    context?: Context,
  ): Promise<void> {
    return this.withTransaction(context, async (transactionContext) => {
      const [categories, collections] = await Promise.all([
        this.findRuled(this.productCategoryRepository, categoryIds, transactionContext),
        this.findRuled(this.productCollectionRepository, collectionIds, transactionContext),
      ])
      if (categories.length === 0 && collections.length === 0) return

      const scopedProductIds =
        productIds ??
        (await this.productRepository.find(undefined, { select: ['id'] }, transactionContext)).map(
          (product) => product.id,
        )
      if (scopedProductIds.length === 0) return

      const [fieldsOf, builtinFields] = await Promise.all([
        this.productMetafieldRepository.findFieldValuesOfProducts(scopedProductIds, transactionContext),
        this.productMetafieldDefinitionRepository.find(
          { source: ['vendor', 'type'] },
          { select: ['key'] },
          transactionContext,
        ),
      ])
      const facts = { fieldsOf, caseInsensitiveKeys: new Set(builtinFields.map((field) => field.key)) }

      await this.applyRules(this.productProductCategoryRepository, categories, facts, transactionContext)
      await this.applyRules(this.productProductCollectionRepository, collections, facts, transactionContext)
    })
  }

  /** The live ruled groupings among `ids`, or all of them when `ids` is absent. */
  private async findRuled(
    repository: ProductCategoryRepository | ProductCollectionRepository,
    ids: string[] | undefined,
    context: Context,
  ): Promise<RuledGrouping[]> {
    if (ids?.length === 0) return []
    const groupings: RuledGrouping[] = await repository.find(
      ids ? { id: ids } : undefined,
      { select: ['id', 'rule'] },
      context,
    )
    return groupings.filter((grouping) => grouping.rule !== null)
  }

  /** Diffs each grouping's members among the scoped products against its rule, and writes the difference. */
  private async applyRules(
    pivot: MembershipPivot,
    groupings: RuledGrouping[],
    { fieldsOf, caseInsensitiveKeys }: ProductFacts,
    context: Context,
  ): Promise<void> {
    if (groupings.length === 0) return
    const membershipsOf = await pivot.findGroupingsOfProducts([...fieldsOf.keys()], context)

    await Promise.all(
      groupings.map(({ id, rule }) => {
        if (!rule) return undefined
        const add: string[] = []
        const remove: string[] = []
        for (const [productId, fields] of fieldsOf) {
          const isMember = membershipsOf.get(productId)?.some((grouping) => grouping.id === id) ?? false
          const matches = matchesGroupingRule(rule, fields, caseInsensitiveKeys)
          if (matches && !isMember) add.push(productId)
          if (!matches && isMember) remove.push(productId)
        }
        if (add.length === 0 && remove.length === 0) return undefined
        return pivot.setProducts(id, { add, remove }, context)
      }),
    )
  }
}
