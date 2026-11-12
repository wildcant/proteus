import { z } from 'zod'

/** One problem with a structure file. `path` is where it is in the file, `categorias[0].hijos[1].handle`. */
export const AdminCatalogStructureError = z
  .object({ path: z.string(), message: z.string() })
  .openapi('AdminCatalogStructureError')
export type AdminCatalogStructureError = z.input<typeof AdminCatalogStructureError>

/**
 * A metafield definition the file creates, updates or deletes. `filterable` is its `filtro`; `source`
 * is its `origen`, `vendor` being the product's brand and `type` its Product Type rather than a metafield.
 */
export const AdminCatalogStructureMetafieldChange = z
  .object({
    key: z.string(),
    name: z.string(),
    filterable: z.boolean(),
    source: z.enum(['metafield', 'vendor', 'type']),
  })
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

const AdminNavigationTargetType = z.enum(['category', 'collection'])

/**
 * A link a menu section names by hand: the entry's own list filtered by field values (`filter`, by
 * clave), or a Category or Collection by handle, labelled by `name` or, when null, by its own.
 */
const AdminNavigationLink = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('filter'), name: z.string(), filter: z.record(z.string(), z.array(z.string())) }),
    z.object({ type: AdminNavigationTargetType, handle: z.string(), name: z.string().nullable() }),
  ])
  .openapi('AdminNavigationLink')

/** A section's `nota`, the short text shown under its links. */
const note = z.string().optional()

/**
 * One section of a menu entry's panel as the file writes it: the entry's child Categories; each value
 * of one field among its products (at most `limit`); those values grouped by `groupKey` (at most
 * `groups` groups, `limit` values each); each value of a product option (`option`, by title); or
 * fixed links.
 */
const AdminNavigationSection = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('subcategories'), name: z.string(), note }),
    z.object({
      type: z.literal('values'),
      name: z.string(),
      key: z.string(),
      limit: z.number().int().nullable(),
      note,
    }),
    z.object({
      type: z.literal('groups'),
      name: z.string(),
      key: z.string(),
      groupKey: z.string(),
      groups: z.number().int().nullable(),
      limit: z.number().int().nullable(),
      note,
    }),
    z.object({ type: z.literal('option'), name: z.string(), option: z.string(), note }),
    z.object({ type: z.literal('links'), name: z.string(), links: z.array(AdminNavigationLink), note }),
  ])
  .openapi('AdminNavigationSection')

/**
 * One entry of the store's menu: a Category or a Collection. Without `sections` a Category brings its
 * children; with them the entry opens a panel of those sections. `footer` holds the links set apart
 * below the panel's columns.
 */
export const AdminNavigationEntry = z
  .object({
    type: AdminNavigationTargetType,
    handle: z.string(),
    sections: z.array(AdminNavigationSection),
    footer: z.array(AdminNavigationLink).optional(),
  })
  .openapi('AdminNavigationEntry')
export type AdminNavigationEntry = z.input<typeof AdminNavigationEntry>

/**
 * What a structure file does to the store: to the metafield definitions by key, where an update is a
 * new name, filter switch, source or place, and to the groupings by handle, where an update is a new name, rule or rank, or an
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
