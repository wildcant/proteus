import { parseDocument } from 'yaml'
import { z } from 'zod'
import type {
  CatalogStructureCategoryDTO,
  CatalogStructureDTO,
  CatalogStructureErrorDTO,
} from '../../../../core/types/product/common.js'
import type {
  StoreNavigationEntryDTO,
  StoreNavigationLinkDTO,
  StoreNavigationSectionDTO,
} from '../../../../core/types/store/common.js'

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

/** `limite` on a `valores` section: how many values the column shows at most. */
const limit = z
  .number({ error: ifWrongType('Must be a positive whole number.') })
  .int('Must be a positive whole number.')
  .positive('Must be a positive whole number.')

const show = z.union([z.literal('subcategorias'), z.strictObject({ valores: key, limite: limit.optional() })], {
  error: ifWrongType('Must be "subcategorias" or "{ valores: <clave>, limite: <n> }".'),
})

/**
 * One fixed link: `nombre` with a `filtro` (the entry's list filtered), or a `categoria` or `coleccion`
 * by handle with an optional `nombre`. One object rather than a union so a problem inside one is
 * reported at its own key; which keys go together is checked after the shape.
 */
const link = z.strictObject(
  { nombre: name.optional(), filtro: rule.optional(), categoria: handle.optional(), coleccion: handle.optional() },
  { error: ifWrongType('Must be a link with nombre and filtro, or a categoria or coleccion.') },
)

type RawLink = z.infer<typeof link>

const section = z.strictObject(
  {
    nombre: name,
    mostrar: show.optional(),
    enlaces: z.array(link, { error: ifWrongType('Must be a list of links.') }).optional(),
  },
  { error: ifWrongType('Must be a section with nombre and one of mostrar or enlaces.') },
)

type RawSection = z.infer<typeof section>

/** Like `link`, one object whose key pairing is checked after the shape. */
const menuEntry = z.strictObject(
  {
    categoria: handle.optional(),
    coleccion: handle.optional(),
    secciones: z.array(section, { error: ifWrongType('Must be a list of sections.') }).optional(),
  },
  { error: ifWrongType('Must be one of "categoria: <handle>" or "coleccion: <handle>".') },
)

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
 * and every menu entry names one the file declares. A menu entry's `secciones` read only declared
 * claves (`valores`, `filtro`) and link only declared handles; only a Category has `subcategorias`.
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
  /** A rule, or a link's `filtro`, which is written the same way: `at` is the key it sits under. */
  const toRule = (raw: RawRule | undefined, path: string, at = 'regla') => {
    if (!raw) return null
    for (const ruleKey of Object.keys(raw)) {
      if (!keys.has(ruleKey)) {
        errors.push({ path: `${path}.${at}.${ruleKey}`, message: `No campo in the file has the clave "${ruleKey}".` })
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

  /** A Category or Collection named by handle, reported at `path` when the file declares no such one. */
  const toTarget = (raw: { categoria?: string; coleccion?: string }, path: string) => {
    if (raw.categoria !== undefined) {
      if (!categoryHandles.has(raw.categoria)) {
        errors.push({
          path: `${path}.categoria`,
          message: `No category in the file has the handle "${raw.categoria}".`,
        })
      }
      return { type: 'category' as const, handle: raw.categoria }
    }
    const collectionHandle = raw.coleccion ?? ''
    if (!collectionHandles.has(collectionHandle)) {
      errors.push({
        path: `${path}.coleccion`,
        message: `No collection in the file has the handle "${collectionHandle}".`,
      })
    }
    return { type: 'collection' as const, handle: collectionHandle }
  }
  const hasOneTarget = (raw: { categoria?: string; coleccion?: string }) =>
    (raw.categoria === undefined) !== (raw.coleccion === undefined)

  const toLink = (raw: RawLink, path: string): StoreNavigationLinkDTO | null => {
    if (raw.filtro) {
      if (raw.categoria !== undefined || raw.coleccion !== undefined) {
        errors.push({ path, message: 'Must have exactly one of filtro, categoria or coleccion.' })
        return null
      }
      if (raw.nombre === undefined) {
        errors.push({ path, message: 'A link with a filtro must have a nombre.' })
        return null
      }
      return { type: 'filter', name: raw.nombre, filter: toRule(raw.filtro, path, 'filtro') ?? {} }
    }
    if (!hasOneTarget(raw)) {
      errors.push({ path, message: 'Must have exactly one of filtro, categoria or coleccion.' })
      return null
    }
    return { ...toTarget(raw, path), name: raw.nombre ?? null }
  }

  const toSection = (
    raw: RawSection,
    path: string,
    entryType: StoreNavigationEntryDTO['type'],
  ): StoreNavigationSectionDTO | null => {
    if ((raw.mostrar === undefined) === (raw.enlaces === undefined)) {
      errors.push({ path, message: 'Must have exactly one of mostrar or enlaces.' })
      return null
    }
    if (raw.enlaces) {
      const links = raw.enlaces.map((rawLink, index) => toLink(rawLink, `${path}.enlaces[${index}]`))
      return { type: 'links', name: raw.nombre, links: links.filter((found) => found !== null) }
    }
    if (raw.mostrar === 'subcategorias') {
      if (entryType === 'collection') {
        errors.push({ path: `${path}.mostrar`, message: 'A collection has no subcategorias.' })
      }
      return { type: 'subcategories', name: raw.nombre }
    }
    const { valores, limite } = raw.mostrar ?? { valores: '' }
    if (!keys.has(valores)) {
      errors.push({ path: `${path}.mostrar.valores`, message: `No campo in the file has the clave "${valores}".` })
    }
    return { type: 'values', name: raw.nombre, key: valores, limit: limite ?? null }
  }

  const navigation = menu.flatMap((entry, index): StoreNavigationEntryDTO[] => {
    const path = `menu[${index}]`
    if (!hasOneTarget(entry)) {
      errors.push({ path, message: 'Must be one of "categoria: <handle>" or "coleccion: <handle>".' })
      return []
    }
    const target = toTarget(entry, path)
    const sections = (entry.secciones ?? [])
      .map((raw, sectionIndex) => toSection(raw, `${path}.secciones[${sectionIndex}]`, target.type))
      .filter((found) => found !== null)
    return [{ ...target, sections }]
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
