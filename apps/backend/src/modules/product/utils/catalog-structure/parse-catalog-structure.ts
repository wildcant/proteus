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

const rule = z
  .array(
    z
      .array(
        z
          .string({ error: ifWrongType('Must be a tag.') })
          .trim()
          .min(1, 'Must not be empty.'),
        {
          error: ifWrongType('Must be a list of tags, any one of which matches.'),
        },
      )
      .min(1, 'Must name at least one tag.'),
    { error: ifWrongType('Must be a list of conditions, each a list of tags.') },
  )
  .min(1, 'Must hold at least one condition.')

type RawCategory = { nombre: string; handle: string; regla?: string[][]; hijos?: RawCategory[] }

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
    categorias: z.array(category, { error: ifWrongType('Must be a list of categories.') }).default([]),
    colecciones: z.array(collection, { error: ifWrongType('Must be a list of collections.') }).default([]),
    menu: z.array(menuEntry, { error: ifWrongType('Must be a list of menu entries.') }).default([]),
  },
  { error: ifWrongType('The file must be a mapping with categorias, colecciones and menu.') },
)

export type ParsedCatalogStructure =
  | { structure: CatalogStructureDTO; errors: [] }
  | {
      structure: null
      errors: CatalogStructureErrorDTO[]
    }

/**
 * Reads `estructura.yaml` into a structure, or every problem with it, each with the path it is at
 * (`categorias[0].hijos[1].handle`). Beyond the shape: a handle is used once among the Categories
 * and once among the Collections, and every menu entry names one the file declares.
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

  const { categorias, colecciones, menu } = parsed.data
  const errors: CatalogStructureErrorDTO[] = []

  const categoryHandles = new Set<string>()
  const toCategory = (raw: RawCategory, path: string): CatalogStructureCategoryDTO => {
    if (categoryHandles.has(raw.handle)) {
      errors.push({ path: `${path}.handle`, message: `The category handle "${raw.handle}" is used more than once.` })
    }
    categoryHandles.add(raw.handle)
    return {
      name: raw.nombre,
      handle: raw.handle,
      rule: raw.regla ?? null,
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
    return { name: raw.nombre, handle: raw.handle, rule: raw.regla ?? null }
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
  return { structure: { categories, collections, menu: navigation }, errors: [] }
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
