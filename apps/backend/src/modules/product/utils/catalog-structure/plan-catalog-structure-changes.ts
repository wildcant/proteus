import type {
  CatalogStructureCategoryDTO,
  CatalogStructureChangesDTO,
  CatalogStructureDTO,
  ProductCategoryDTO,
  ProductCollectionDTO,
  ProductGroupingRuleDTO,
} from '../../../../core/types/product/common.js'

/** A file Category with where the file puts it: its parent's handle and its rank among its siblings. */
export type PlacedStructureCategory = CatalogStructureCategoryDTO & { parentHandle: string | null; rank: number }

/** The file's Categories parents first, each with its place. Applying them in this order never parents one under its own subtree. */
export function flattenStructureCategories(categories: CatalogStructureCategoryDTO[]): PlacedStructureCategory[] {
  const placed: PlacedStructureCategory[] = []
  const visit = (siblings: CatalogStructureCategoryDTO[], parentHandle: string | null) => {
    placed.push(...siblings.map((category, rank) => ({ ...category, parentHandle, rank })))
    for (const category of siblings) visit(category.children, category.handle)
  }
  visit(categories, null)
  return placed
}

/**
 * The live Categories the file leaves out, leaf-first in levels: every level can be deleted once the
 * ones after it in the list are gone, because a kept Category under one of them is moved away first.
 */
export function absentCategoryLevels(structure: CatalogStructureDTO, live: ProductCategoryDTO[]): string[][] {
  const kept = new Set(flattenStructureCategories(structure.categories).map((category) => category.handle))
  const byId = new Map(live.map((category) => [category.id, category]))
  const depthOf = (category: ProductCategoryDTO): number => {
    const parent = category.parentId ? byId.get(category.parentId) : undefined
    return parent ? depthOf(parent) + 1 : 0
  }

  const levels: string[][] = []
  for (const category of live) {
    if (kept.has(category.handle)) continue
    const depth = depthOf(category)
    levels[depth] = [...(levels[depth] ?? []), category.id]
  }
  return levels.filter((level) => level.length > 0).reverse()
}

/** What applying `structure` would do to the live groupings, matched by handle. */
export function planCatalogStructureChanges(
  structure: CatalogStructureDTO,
  categories: ProductCategoryDTO[],
  collections: ProductCollectionDTO[],
): CatalogStructureChangesDTO {
  const changes: CatalogStructureChangesDTO = {
    categories: { create: [], update: [], move: [], delete: [] },
    collections: { create: [], update: [], delete: [] },
  }

  const categoryByHandle = new Map(categories.map((category) => [category.handle, category]))
  const handleOfId = new Map(categories.map((category) => [category.id, category.handle]))
  const parentHandleOf = (category: ProductCategoryDTO) =>
    category.parentId ? (handleOfId.get(category.parentId) ?? null) : null

  const placed = flattenStructureCategories(structure.categories)
  for (const category of placed) {
    const row = { handle: category.handle, name: category.name, parentHandle: category.parentHandle }
    const live = categoryByHandle.get(category.handle)
    if (!live) {
      changes.categories.create.push(row)
      continue
    }
    const previousParentHandle = parentHandleOf(live)
    if (previousParentHandle !== category.parentHandle) {
      changes.categories.move.push({ ...row, previousParentHandle })
      continue
    }
    const changed =
      live.name !== category.name ||
      !sameRule(live.rule, category.rule) ||
      !live.isActive ||
      live.rank !== category.rank
    if (changed) changes.categories.update.push(row)
  }

  const kept = new Set(placed.map((category) => category.handle))
  for (const category of categories) {
    if (kept.has(category.handle)) continue
    changes.categories.delete.push({
      handle: category.handle,
      name: category.name,
      parentHandle: parentHandleOf(category),
    })
  }

  const collectionByHandle = new Map(collections.map((collection) => [collection.handle, collection]))
  for (const collection of structure.collections) {
    const row = { handle: collection.handle, name: collection.name }
    const live = collectionByHandle.get(collection.handle)
    if (!live) changes.collections.create.push(row)
    else if (live.title !== collection.name || !sameRule(live.rule, collection.rule)) {
      changes.collections.update.push(row)
    }
  }
  const keptCollections = new Set(structure.collections.map((collection) => collection.handle))
  for (const collection of collections) {
    if (keptCollections.has(collection.handle)) continue
    changes.collections.delete.push({ handle: collection.handle, name: collection.title })
  }

  return changes
}

function sameRule(left: ProductGroupingRuleDTO | null, right: ProductGroupingRuleDTO | null): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
