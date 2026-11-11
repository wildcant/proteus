import { z } from 'zod'

/** One problem with a structure file. `path` is where it is in the file, `categorias[0].hijos[1].handle`. */
export const AdminCatalogStructureError = z
  .object({ path: z.string(), message: z.string() })
  .openapi('AdminCatalogStructureError')
export type AdminCatalogStructureError = z.input<typeof AdminCatalogStructureError>

/** A metafield definition the file creates, renames or deletes. */
export const AdminCatalogStructureMetafieldChange = z
  .object({ key: z.string(), name: z.string() })
  .openapi('AdminCatalogStructureMetafieldChange')

/** A Category the file creates, updates or deletes. `parentHandle` is where it ends up, or where it was for a delete. */
export const AdminCatalogStructureCategoryChange = z
  .object({ handle: z.string(), name: z.string(), parentHandle: z.string().nullable() })
  .openapi('AdminCatalogStructureCategoryChange')

export const AdminCatalogStructureCategoryMove = AdminCatalogStructureCategoryChange.extend({
  previousParentHandle: z.string().nullable(),
}).openapi('AdminCatalogStructureCategoryMove')

export const AdminCatalogStructureCollectionChange = z
  .object({ handle: z.string(), name: z.string() })
  .openapi('AdminCatalogStructureCollectionChange')

/** One entry of the store's menu: a Category, which brings its children, or a Collection. */
export const AdminNavigationEntry = z
  .object({ type: z.enum(['category', 'collection']), handle: z.string() })
  .openapi('AdminNavigationEntry')
export type AdminNavigationEntry = z.input<typeof AdminNavigationEntry>

/**
 * What a structure file does to the store: to the metafield definitions by key, where an update is a
 * new name, and to the groupings by handle, where an update is a new name, rule or rank, or an
 * inactive Category turned active, and a move is a new parent, listed only as a move. A file with
 * errors changes nothing and cannot be applied.
 */
export const AdminCatalogStructurePlan = z
  .object({
    errors: z.array(AdminCatalogStructureError),
    metafields: z.object({
      create: z.array(AdminCatalogStructureMetafieldChange),
      update: z.array(AdminCatalogStructureMetafieldChange),
      delete: z.array(AdminCatalogStructureMetafieldChange),
    }),
    categories: z.object({
      create: z.array(AdminCatalogStructureCategoryChange),
      update: z.array(AdminCatalogStructureCategoryChange),
      move: z.array(AdminCatalogStructureCategoryMove),
      delete: z.array(AdminCatalogStructureCategoryChange),
    }),
    collections: z.object({
      create: z.array(AdminCatalogStructureCollectionChange),
      update: z.array(AdminCatalogStructureCollectionChange),
      delete: z.array(AdminCatalogStructureCollectionChange),
    }),
    /** The store's menu now, and as the file has it. */
    menu: z.object({ current: z.array(AdminNavigationEntry), next: z.array(AdminNavigationEntry) }),
  })
  .openapi('AdminCatalogStructurePlan')
export type AdminCatalogStructurePlan = z.input<typeof AdminCatalogStructurePlan>
