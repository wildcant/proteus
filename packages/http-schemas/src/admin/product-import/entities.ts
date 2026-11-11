import { z } from 'zod'
import { dateToIso } from '../../common.js'
import { ProductStatus } from '../product/entities.js'

/**
 * `previewed` → `importing` → `completed` | `failed`, or `previewed` → `canceled` | `expired`.
 * `failed` means no product made it in; a run where only some failed is `completed`.
 */
export const ProductImportStatus = z.enum(['previewed', 'importing', 'completed', 'failed', 'canceled', 'expired'])

/** One problem with the file or with one product's import. `line` is the CSV line, the header being line 1. */
export const AdminProductImportError = z
  .object({
    line: z.number(),
    handle: z.string().nullable(),
    message: z.string(),
  })
  .openapi('AdminProductImportError')
export type AdminProductImportError = z.input<typeof AdminProductImportError>

export const AdminImportedVariant = z
  .object({
    line: z.number(),
    sku: z.string().nullable(),
    /** In the product's option order. */
    optionValues: z.array(z.string()),
    /** Grams. */
    weight: z.number().nullable(),
    manageInventory: z.boolean(),
    allowBackorder: z.boolean(),
    inventoryQuantity: z.number().nullable(),
    prices: z.array(z.object({ currencyCode: z.string(), amount: z.number() })),
    imageUrl: z.string().nullable(),
  })
  .openapi('AdminImportedVariant')

/** A product as the file describes it. */
export const AdminImportedProduct = z
  .object({
    line: z.number(),
    rows: z.number(),
    handle: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    status: ProductStatus,
    type: z.string().nullable(),
    categoryHandles: z.array(z.string()),
    collectionHandles: z.array(z.string()),
    tags: z.array(z.string()),
    options: z.array(z.object({ title: z.string(), values: z.array(z.string()) })),
    variants: z.array(AdminImportedVariant),
    imageUrls: z.array(z.string()),
  })
  .openapi('AdminImportedProduct')

export const AdminProductImportSummary = z
  .object({
    /** Products by what the import will do with them: new handles, existing ones overwritten, existing ones left alone. */
    products: z.object({ create: z.number(), update: z.number(), skip: z.number() }),
    skus: z.number(),
    images: z.number(),
    /** Grouping handles and values the file names that do not exist yet, created when the import runs. */
    willCreate: z.object({
      categories: z.array(z.string()),
      collections: z.array(z.string()),
      tags: z.array(z.string()),
      types: z.array(z.string()),
    }),
    /** Columns in the file the import does not read. */
    ignoredColumns: z.array(z.string()),
    firstProduct: AdminImportedProduct.nullable(),
  })
  .openapi('AdminProductImportSummary')

export const AdminProductImport = z
  .object({
    id: z.string(),
    status: ProductImportStatus,
    options: z.object({ overwrite: z.boolean(), publish: z.boolean() }),
    summary: AdminProductImportSummary,
    /** Products done so far, by outcome. Their sum against `summary.products` is the run's progress. */
    created: z.number(),
    updated: z.number(),
    skipped: z.number(),
    failed: z.number(),
    /** Every error in the file (a job with any cannot be confirmed), then every product that failed to import. */
    errors: z.array(AdminProductImportError),
    createdAt: dateToIso,
    updatedAt: dateToIso,
  })
  .openapi('AdminProductImport')
export type AdminProductImport = z.input<typeof AdminProductImport>
