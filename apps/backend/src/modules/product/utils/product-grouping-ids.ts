import type { ProductGroupingIdsDTO } from '../../../core/types/product/mutations.js'

/** Splits a product write into its own columns and the pivot-backed groupings it sets. */
export function separateGroupingIds<T extends ProductGroupingIdsDTO>({
  categoryIds,
  collectionIds,
  tagIds,
  ...fields
}: T): { fields: Omit<T, keyof ProductGroupingIdsDTO>; groupingIds: ProductGroupingIdsDTO } {
  return { fields, groupingIds: { categoryIds, collectionIds, tagIds } }
}
