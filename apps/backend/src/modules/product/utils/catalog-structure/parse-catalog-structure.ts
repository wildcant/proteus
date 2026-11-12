import { parseDocument } from 'yaml'
import { z } from 'zod'
import type {
  CatalogStructureCategoryDTO,
  CatalogStructureDTO,
  CatalogStructureErrorDTO,
} from '../../../../core/types/product/common.js'

/** A structure file is a page of YAML; anything near this is not one. */
export const MAX_STRUCTURE_FILE_BYTES = 1024 * 1024

/** Lowercase letters and digits in hyphen-separated runs, as `toHandle` writes them. */
const HANDLE_PATTERN = /^[\p{Ll}\p{Lo}\p{N}]+(?:-[\p{Ll}\p{Lo}\p{N}]+)*$/u

/**
 * A schema's own message for a value of the wrong kind. Every other issue it raises — an unknown key
 * most of all — keeps zod's default, which names the key.
 */
const ifWrongType = (message: string) => (issue: { code?: string }) =>
  issue.code === 'invalid_type' || issue.code === 'invalid_union' ? message : undefined

const handle = z
  .string({ error: ifWrongType('Must be a handle.') })
  .regex(HANDLE_PATTERN, 'Must be lowercase letters and digits joined by hyphens, like "hombre-clasicos".')

const name = z
  .string({ error: ifWrongType('Must be a name.') })
  .trim()
  .min(1, 'Must not be empty.')

/** Shopify's limits on a metafield key, narrowed to lowercase so a key is written one way. */
const KEY_PATTERN = /^[a-z0-9_-]{2,64}$/

const key = z
  .string({ error: ifWrongType('Must be a clave.') })
  .regex(KEY_PATTERN, 'Must be 2 to 64 lowercase letters, digits, "-" or "_", like "genero".')

/** `filtro: true` offers the campo as a storefront filter, Shopify's per-definition filter switch. */
const filter = z.boolean({ error: ifWrongType('Must be true or false.') })

/** `origen: vendor` makes the campo the product's brand, the CSV's Vendor column, rather than a metafield. */
const source = z.literal('vendor', { error: 'Must be "vendor", or left out for a metafield.' })

const field = z.strictObject(
  { nombre: name, clave: key, filtro: filter.optional(), origen: source.optional() },
  { error: ifWrongType('Must be a campo with nombre and clave.') },
)

const rule = z
  .record(
    z.string(),
    z
      .array(
        z
          .string({ error: ifWrongType('Must be a value.') })
          .trim()
          .min(1, 'Must not be empty.'),
        { error: ifWrongType('Must be a list of values, any one of which matches.') },
      )
      .min(1, 'Must name at least one value.'),
    { error: ifWrongType('Must be a mapping of claves to lists of values.') },
  )
  .refine((conditions) => Object.keys(conditions).length > 0, 'Must hold at least one condition.')

type RawRule = Record<string, string[]>

type RawCategory = { nombre: string; handle: string; regla?: RawRule; hijos?: RawCategory[] }

const category: z.ZodType<RawCategory> = z.lazy(() =>
  z.strictObject(
    {
      nombre: name,
      handle,
      regla: rule.optional(),
      hijos: z.array(category, { error: ifWrongType('Must be a list of categories.') }).optional(),
    },
    { error: ifWrongType('Must be a category with nombre and handle.') },
  ),
)

const collection = z.strictObject(
  { nombre: name, handle, regla: rule.optional() },
  { error: ifWrongType('Must be a collection with nombre and handle.') },
)

const menuEntry = z.union([z.strictObject({ categoria: handle }), z.strictObject({ coleccion: handle })], {
  error: ifWrongType('Must be one of "categoria: <handle>" or "coleccion: <handle>".'),
})

const structureFile = z.strictObject(
  {
    campos: z.array(field, { error: ifWrongType('Must be a list of campos.') }).default([]),
    categorias: z.array(category, { error: ifWrongType('Must be a list of categories.') }).default([]),
    colecciones: z.array(collection, { error: ifWrongType('Must be a list of collections.') }).default([]),
    menu: z.array(menuEntry, { error: ifWrongType('Must be a list of menu entries.') }).default([]),
  },
  { error: ifWrongType('The file must be a mapping with campos, categorias, colecciones and menu.') },
)

export type ParsedCatalogStructure =
  | { structure: CatalogStructureDTO; errors: [] }
  | {
      structure: null
      errors: CatalogStructureErrorDTO[]
    }

/**
 * Reads `estructura.yaml` into a structure, or every problem with it, each with the path it is at
 * (`categorias[0].hijos[1].handle`). Beyond the shape: a clave is declared once, at most one campo
 * is the vendor (`origen: vendor`), every rule names
 * only declared claves, a handle is used once among the Categories and once among the Collections,
 * and every menu entry names one the file declares.
 */
export function parseCatalogStructure(text: string): ParsedCatalogStructure {
  const document = parseDocument(text, { prettyErrors: false })
  if (document.errors.length > 0) {
    return fail(
      document.errors.map((error) => ({
        path: '',
        message: `The file is not valid YAML: ${error.message.split('\n')[0]}`,
      })),
    )
  }

  const parsed = structureFile.safeParse(document.toJS() ?? {})
  if (!parsed.success) {
    return fail(parsed.error.issues.map((issue) => ({ path: formatPath(issue.path), message: issue.message })))
  }

  const { campos, categorias, colecciones, menu } = parsed.data
  const errors: CatalogStructureErrorDTO[] = []

  const keys = new Set<string>()
  let vendorKey: string | null = null
  const metafields = campos.map((raw, index) => {
    if (keys.has(raw.clave)) {
      errors.push({ path: `campos[${index}].clave`, message: `The clave "${raw.clave}" is used more than once.` })
    }
    keys.add(raw.clave)
    if (raw.origen === 'vendor') {
      if (vendorKey !== null) {
        errors.push({
          path: `campos[${index}].origen`,
          message: `Only one campo can be the vendor; "${vendorKey}" already is.`,
        })
      }
      vendorKey ??= raw.clave
    }
    return {
      name: raw.nombre,
      key: raw.clave,
      filterable: raw.filtro ?? false,
      source: raw.origen ?? ('metafield' as const),
    }
  })
  const toRule = (raw: RawRule | undefined, path: string) => {
    if (!raw) return null
    for (const ruleKey of Object.keys(raw)) {
      if (!keys.has(ruleKey)) {
        errors.push({ path: `${path}.regla.${ruleKey}`, message: `No campo in the file has the clave "${ruleKey}".` })
      }
    }
    return raw
  }

  const categoryHandles = new Set<string>()
  const toCategory = (raw: RawCategory, path: string): CatalogStructureCategoryDTO => {
    if (categoryHandles.has(raw.handle)) {
      errors.push({ path: `${path}.handle`, message: `The category handle "${raw.handle}" is used more than once.` })
    }
    categoryHandles.add(raw.handle)
    return {
      name: raw.nombre,
      handle: raw.handle,
      rule: toRule(raw.regla, path),
      children: (raw.hijos ?? []).map((child, index) => toCategory(child, `${path}.hijos[${index}]`)),
    }
  }
  const categories = categorias.map((raw, index) => toCategory(raw, `categorias[${index}]`))

  const collectionHandles = new Set<string>()
  const collections = colecciones.map((raw, index) => {
    if (collectionHandles.has(raw.handle)) {
      errors.push({
        path: `colecciones[${index}].handle`,
        message: `The collection handle "${raw.handle}" is used more than once.`,
      })
    }
    collectionHandles.add(raw.handle)
    return { name: raw.nombre, handle: raw.handle, rule: toRule(raw.regla, `colecciones[${index}]`) }
  })

  const navigation = menu.map((entry, index) => {
    if ('categoria' in entry) {
      if (!categoryHandles.has(entry.categoria)) {
        errors.push({
          path: `menu[${index}].categoria`,
          message: `No category in the file has the handle "${entry.categoria}".`,
        })
      }
      return { type: 'category' as const, handle: entry.categoria }
    }
    if (!collectionHandles.has(entry.coleccion)) {
      errors.push({
        path: `menu[${index}].coleccion`,
        message: `No collection in the file has the handle "${entry.coleccion}".`,
      })
    }
    return { type: 'collection' as const, handle: entry.coleccion }
  })

  if (errors.length > 0) return fail(errors)
  return { structure: { metafields, categories, collections, menu: navigation }, errors: [] }
}

function fail(errors: CatalogStructureErrorDTO[]): ParsedCatalogStructure {
  return { structure: null, errors }
}

/** `['categorias', 0, 'hijos', 1, 'handle']` → `categorias[0].hijos[1].handle`. */
function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((formatted, key) => {
    if (typeof key === 'number') return `${formatted}[${key}]`
    return formatted ? `${formatted}.${String(key)}` : String(key)
  }, '')
}
