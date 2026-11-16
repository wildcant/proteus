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
  StoreSearchDTO,
} from '../../../../core/types/store/common.js'
import { parseSublineTemplate, SUBLINE_BUILTIN_PLACEHOLDERS, sublineKeys } from '../../../../core/utils/card-subline.js'
import { OPTION_FILTER_PREFIX, SALE_FILTER_KEY, SALE_FILTER_VALUE } from '../../../../core/utils/product-filter-key.js'
import { HANDLE_PATTERN } from '../../../../core/utils/to-handle.js'

/** A structure file is a page of YAML; anything near this is not one. */
export const MAX_STRUCTURE_FILE_BYTES = 1024 * 1024

/**
 * A schema's own message for a value of the wrong kind. Every other issue it raises — an unknown key
 * most of all — keeps zod's default, which names the key.
 */
const ifWrongType = (message: string) => (issue: { code?: string }) =>
  issue.code === 'invalid_type' || issue.code === 'invalid_union' ? message : undefined

const handle = z
  .string({ error: ifWrongType('Must be a handle.') })
  .regex(HANDLE_PATTERN, 'Must be lowercase letters and digits joined by hyphens, like "men-tops".')

const name = z
  .string({ error: ifWrongType('Must be a name.') })
  .trim()
  .min(1, 'Must not be empty.')

/** Shopify's limits on a metafield key, narrowed to lowercase so a key is written one way. */
const KEY_PATTERN = /^[a-z0-9_-]{2,64}$/

const key = z
  .string({ error: ifWrongType('Must be a key.') })
  .regex(KEY_PATTERN, 'Must be 2 to 64 lowercase letters, digits, "-" or "_", like "gender".')

/** `filterable: true` offers the field as a storefront filter, Shopify's per-definition filter switch. */
const filterable = z.boolean({ error: ifWrongType('Must be true or false.') })

/**
 * `source: vendor` makes the field the product's brand, the CSV's Vendor column, and `source: type` its
 * Product Type, the CSV's Type column, rather than a metafield.
 */
const source = z.enum(['vendor', 'type'], { error: 'Must be "vendor" or "type", or left out for a metafield.' })

const field = z.strictObject(
  { name, key, filterable: filterable.optional(), source: source.optional() },
  { error: ifWrongType('Must be a field with name and key.') },
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
    { error: ifWrongType('Must be a mapping of keys to lists of values.') },
  )
  .refine((conditions) => Object.keys(conditions).length > 0, 'Must hold at least one condition.')

type RawRule = Record<string, string[]>

type RawCategory = { name: string; handle: string; heading?: string; rule?: RawRule; children?: RawCategory[] }

const category: z.ZodType<RawCategory> = z.lazy(() =>
  z.strictObject(
    {
      name,
      handle,
      heading: name.optional(),
      rule: rule.optional(),
      children: z.array(category, { error: ifWrongType('Must be a list of categories.') }).optional(),
    },
    { error: ifWrongType('Must be a category with name and handle.') },
  ),
)

/** `badge`: what a member's list card wears, `new`. */
const collection = z.strictObject(
  { name, handle, rule: rule.optional(), badge: name.optional() },
  { error: ifWrongType('Must be a collection with name and handle.') },
)

/**
 * A filter bucket of an option: `name` is what the filter offers, `swatch` free text the storefront
 * draws it from (a hex, a CSS colour, an image URL, a key: Proteus does not read it), and `words` the
 * words that put a value in it, matched whole and ignoring case. A value joins every bucket holding
 * one of its words.
 */
const bucket = z.strictObject(
  {
    name,
    swatch: z
      .string({ error: ifWrongType('Must be text.') })
      .trim()
      .min(1, 'Must not be empty.')
      .optional(),
    words: z.array(name, { error: ifWrongType('Must be a list of words.') }).default([]),
  },
  { error: ifWrongType('Must be a bucket with name, swatch and words.') },
)

/**
 * A product option by its title: `role`, the part it plays on the list card, and `buckets`, the groups
 * its filter offers in place of its raw values. Each value joins every bucket holding one of its words.
 */
const option = z.strictObject(
  {
    name,
    role: z.enum(['grouping', 'availability'], { error: 'Must be "grouping" or "availability".' }).optional(),
    buckets: z.array(bucket, { error: ifWrongType('Must be a list of buckets.') }).optional(),
  },
  { error: ifWrongType('Must be an option with name, role and buckets.') },
)

/** `limit` on a `values` section, how many values it shows at most, and `groups`, how many groups. */
const limit = z
  .number({ error: ifWrongType('Must be a positive whole number.') })
  .int('Must be a positive whole number.')
  .positive('Must be a positive whole number.')

/**
 * What a section lists: the entry's subcategories; each value of a field among the entry's products,
 * optionally grouped by a second field (`groupBy`, at most `groups` groups and `limit` values each);
 * or each value of a product option (`option`, by its title, "Size") the entry's products offer.
 */
const show = z.union(
  [
    z.literal('subcategories'),
    z.strictObject({ values: key, limit: limit.optional(), groupBy: key.optional(), groups: limit.optional() }),
    z.strictObject({ option: name }),
  ],
  {
    error: ifWrongType(
      'Must be "subcategories", "{ values: <key>, limit: <n> }", "{ values: <key>, groupBy: <key>, groups: <n>, limit: <n> }" or "{ option: <option> }".',
    ),
  },
)

/**
 * One fixed link: `name` with a `filter` (the entry's list filtered), or a `category` or `collection`
 * by handle with an optional `name`. One object rather than a union so a problem inside one is
 * reported at its own key; which keys go together is checked after the shape.
 */
const link = z.strictObject(
  { name: name.optional(), filter: rule.optional(), category: handle.optional(), collection: handle.optional() },
  { error: ifWrongType('Must be a link with name and filter, or a category or collection.') },
)

type RawLink = z.infer<typeof link>

const section = z.strictObject(
  {
    name,
    show: show.optional(),
    links: z.array(link, { error: ifWrongType('Must be a list of links.') }).optional(),
    note: name.optional(),
  },
  { error: ifWrongType('Must be a section with name and one of show or links.') },
)

type RawSection = z.infer<typeof section>

/**
 * Like `link`, one object whose key pairing is checked after the shape: a `category` or `collection`
 * by handle, or `name` with a `filter`, the all-products list filtered as a filter link is.
 */
const menuEntry = z.strictObject(
  {
    name: name.optional(),
    filter: rule.optional(),
    category: handle.optional(),
    collection: handle.optional(),
    sections: z.array(section, { error: ifWrongType('Must be a list of sections.') }).optional(),
    footer: z.array(link, { error: ifWrongType('Must be a list of links.') }).optional(),
  },
  { error: ifWrongType('Must be one of "category: <handle>" or "collection: <handle>".') },
)

/**
 * A most-searched model: `name`, the list filtered by `filter` (written as a rule is), and `note`, a
 * short line under it, like its style.
 */
const trending = z.strictObject(
  { name, filter: rule, note: name.optional() },
  { error: ifWrongType('Must be a most-searched model with name and filter.') },
)

/** What search offers before the shopper finds anything: `popular`, search terms, and `trending`, models. */
const search = z.strictObject(
  {
    popular: z.array(name, { error: ifWrongType('Must be a list of search terms.') }).default([]),
    trending: z.array(trending, { error: ifWrongType('Must be a list of most-searched models.') }).default([]),
  },
  { error: ifWrongType('Must be a mapping with popular and trending.') },
)

/**
 * The list card: `subline`, the template of the line under its title (`"{type} para {genero|lower}"`,
 * see `card-subline.ts`), and `listSeparator`, what joins a field's several values (default `", "`).
 */
const card = z.strictObject(
  {
    subline: name.optional(),
    listSeparator: z
      .string({ error: ifWrongType('Must be text.') })
      .min(1, 'Must not be empty.')
      .optional(),
  },
  { error: ifWrongType('Must be a mapping with subline and listSeparator.') },
)

/** What joins a field's several values in a subline when the file names no `listSeparator`. */
const DEFAULT_LIST_SEPARATOR = ', '

/** A storefront filter by its key: a field's key, or `option.<Title>` for a product option. */
const filterKey = z
  .string({ error: ifWrongType('Must be a key or option.<Title>.') })
  .trim()
  .min(1, 'Must not be empty.')

/**
 * One way two products are alike: `key`, what they share (`category`, `type`, `brand`, `option.<Title>`
 * or a field's key), and `weight`, what sharing it adds to their likeness.
 */
const relatedMatch = z.strictObject(
  {
    key: filterKey,
    weight: z
      .number({ error: ifWrongType('Must be a whole number.') })
      .int('Must be a whole number.')
      .min(1, 'Must be at least 1.'),
  },
  { error: ifWrongType('Must be a match with key and weight.') },
)

/** The keys a related match reads besides the file's fields and options. */
const RELATED_BUILTIN_KEYS = ['category', 'type', 'brand']

const structureFile = z.strictObject(
  {
    fields: z.array(field, { error: ifWrongType('Must be a list of fields.') }).default([]),
    categories: z.array(category, { error: ifWrongType('Must be a list of categories.') }).default([]),
    collections: z.array(collection, { error: ifWrongType('Must be a list of collections.') }).default([]),
    options: z.array(option, { error: ifWrongType('Must be a list of options.') }).default([]),
    menu: z.array(menuEntry, { error: ifWrongType('Must be a list of menu entries.') }).default([]),
    search: search.default({ popular: [], trending: [] }),
    filters: z.array(filterKey, { error: ifWrongType('Must be a list of filter keys.') }).optional(),
    card: card.optional(),
    related: z.array(relatedMatch, { error: ifWrongType('Must be a list of matches.') }).optional(),
  },
  {
    error: ifWrongType(
      'The file must be a mapping with fields, categories, collections, options, menu, search, filters, card and related.',
    ),
  },
)

export type ParsedCatalogStructure =
  | { structure: CatalogStructureDTO; errors: [] }
  | {
      structure: null
      errors: CatalogStructureErrorDTO[]
    }

/**
 * Reads a structure file into a structure, or every problem with it, each with the path it is at
 * (`categories[0].children[1].handle`). Beyond the shape: a key is declared once, at most one field
 * is the vendor (`source: vendor`) and at most one the type (`source: type`), every rule names
 * only declared keys, a handle is used once among the Categories and once among the Collections,
 * and every menu entry names one the file declares or is a `name` with a `filter`. A menu entry's
 * `sections` and `footer` read only declared keys (`values`, `groupBy`, `filter`) and link only
 * declared handles; a link's or entry's `filter` may also read `price.sale: [on]`. Only a Category
 * has `subcategories`; `groups` needs `groupBy`, which must differ from `values`. A `search` popular
 * term (ignoring case) and a trending model's name are each listed once, and a model's `filter` reads
 * only declared keys. Each `filters` key is listed once and is a declared field with
 * `filterable: true`, `option.<Title>` or `price.sale`. A `card.subline` reads only `{type}`, `{brand}`
 * and declared keys, with no modifier but `lower`. Each `related` key is listed once and is `category`,
 * `type`, `brand`, `option.<Title>` or a declared key, with a whole weight of at least 1.
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

  const {
    fields,
    categories: rawCategories,
    collections: rawCollections,
    options: rawOptions,
    menu,
    search,
    filters,
    card: rawCard,
    related,
  } = parsed.data
  const errors: CatalogStructureErrorDTO[] = []

  const keys = new Set<string>()
  const builtinKeys = new Map<'vendor' | 'type', string>()
  const metafields = fields.map((raw, index) => {
    if (keys.has(raw.key)) {
      errors.push({ path: `fields[${index}].key`, message: `The key "${raw.key}" is used more than once.` })
    }
    keys.add(raw.key)
    if (raw.source) {
      const taken = builtinKeys.get(raw.source)
      if (taken !== undefined) {
        errors.push({
          path: `fields[${index}].source`,
          message: `Only one field can be the ${raw.source}; "${taken}" already is.`,
        })
      } else builtinKeys.set(raw.source, raw.key)
    }
    return {
      name: raw.name,
      key: raw.key,
      filterable: raw.filterable ?? false,
      source: raw.source ?? ('metafield' as const),
    }
  })
  /**
   * A rule, or a link's `filter`, which is written the same way: `at` is the key it sits under. A link
   * lists products, so its filter may also read the built-in `price.sale: [on]`; a rule picks a
   * grouping's members, which a price cannot decide.
   */
  const toRule = (raw: RawRule | undefined, path: string, at = 'rule', { isLink = false } = {}) => {
    if (!raw) return null
    for (const [ruleKey, values] of Object.entries(raw)) {
      if (isLink && ruleKey === SALE_FILTER_KEY) {
        if (values.some((value) => value !== SALE_FILTER_VALUE)) {
          errors.push({
            path: `${path}.${at}.${ruleKey}`,
            message: `The sale filter's one value is "${SALE_FILTER_VALUE}".`,
          })
        }
        continue
      }
      if (!keys.has(ruleKey)) {
        errors.push({ path: `${path}.${at}.${ruleKey}`, message: `No field in the file has the key "${ruleKey}".` })
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
      name: raw.name,
      heading: raw.heading ?? null,
      handle: raw.handle,
      rule: toRule(raw.rule, path),
      children: (raw.children ?? []).map((child, index) => toCategory(child, `${path}.children[${index}]`)),
    }
  }
  const categories = rawCategories.map((raw, index) => toCategory(raw, `categories[${index}]`))

  const collectionHandles = new Set<string>()
  const collections = rawCollections.map((raw, index) => {
    if (collectionHandles.has(raw.handle)) {
      errors.push({
        path: `collections[${index}].handle`,
        message: `The collection handle "${raw.handle}" is used more than once.`,
      })
    }
    collectionHandles.add(raw.handle)
    return {
      name: raw.name,
      handle: raw.handle,
      rule: toRule(raw.rule, `collections[${index}]`),
      badge: raw.badge ?? null,
    }
  })

  const optionNames = new Set<string>()
  const options = rawOptions.map((raw, index) => {
    if (optionNames.has(raw.name)) {
      errors.push({ path: `options[${index}].name`, message: `The option "${raw.name}" is listed more than once.` })
    }
    optionNames.add(raw.name)
    const bucketNames = new Set<string>()
    for (const [bucketIndex, rawBucket] of (raw.buckets ?? []).entries()) {
      if (bucketNames.has(rawBucket.name)) {
        errors.push({
          path: `options[${index}].buckets[${bucketIndex}].name`,
          message: `The bucket "${rawBucket.name}" is used more than once.`,
        })
      }
      bucketNames.add(rawBucket.name)
    }
    return {
      name: raw.name,
      listingRole: raw.role ?? null,
      buckets: (raw.buckets ?? []).map((rawBucket) => ({
        name: rawBucket.name,
        swatch: rawBucket.swatch ?? null,
        words: rawBucket.words,
      })),
    }
  })

  /** A Category or Collection named by handle, reported at `path` when the file declares no such one. */
  const toTarget = (raw: { category?: string; collection?: string }, path: string) => {
    if (raw.category !== undefined) {
      if (!categoryHandles.has(raw.category)) {
        errors.push({
          path: `${path}.category`,
          message: `No category in the file has the handle "${raw.category}".`,
        })
      }
      return { type: 'category' as const, handle: raw.category }
    }
    const collectionHandle = raw.collection ?? ''
    if (!collectionHandles.has(collectionHandle)) {
      errors.push({
        path: `${path}.collection`,
        message: `No collection in the file has the handle "${collectionHandle}".`,
      })
    }
    return { type: 'collection' as const, handle: collectionHandle }
  }
  const hasOneTarget = (raw: { category?: string; collection?: string }) =>
    (raw.category === undefined) !== (raw.collection === undefined)

  const toLink = (raw: RawLink, path: string): StoreNavigationLinkDTO | null => {
    if (raw.filter) {
      if (raw.category !== undefined || raw.collection !== undefined) {
        errors.push({ path, message: 'Must have exactly one of filter, category or collection.' })
        return null
      }
      if (raw.name === undefined) {
        errors.push({ path, message: 'A link with a filter must have a name.' })
        return null
      }
      return { type: 'filter', name: raw.name, filter: toRule(raw.filter, path, 'filter', { isLink: true }) ?? {} }
    }
    if (!hasOneTarget(raw)) {
      errors.push({ path, message: 'Must have exactly one of filter, category or collection.' })
      return null
    }
    return { ...toTarget(raw, path), name: raw.name ?? null }
  }

  const toSection = (
    raw: RawSection,
    path: string,
    entryType: StoreNavigationEntryDTO['type'],
  ): StoreNavigationSectionDTO | null => {
    if ((raw.show === undefined) === (raw.links === undefined)) {
      errors.push({ path, message: 'Must have exactly one of show or links.' })
      return null
    }
    const note = raw.note === undefined ? {} : { note: raw.note }
    if (raw.links) {
      const links = raw.links.map((rawLink, index) => toLink(rawLink, `${path}.links[${index}]`))
      return { type: 'links', name: raw.name, links: links.filter((found) => found !== null), ...note }
    }
    if (raw.show === 'subcategories') {
      if (entryType === 'collection') {
        errors.push({ path: `${path}.show`, message: 'A collection has no subcategories.' })
      }
      return { type: 'subcategories', name: raw.name, ...note }
    }
    const shown = raw.show ?? { option: '' }
    if ('option' in shown) return { type: 'option', name: raw.name, option: shown.option, ...note }
    const { values, limit: valueLimit, groupBy, groups } = shown
    const declared = (declaredKey: string, at: string) => {
      if (keys.has(declaredKey)) return
      errors.push({ path: `${path}.show.${at}`, message: `No field in the file has the key "${declaredKey}".` })
    }
    declared(values, 'values')
    if (groupBy === undefined) {
      if (groups !== undefined) {
        errors.push({ path: `${path}.show.groups`, message: 'groups needs groupBy, the field to group by.' })
      }
      return { type: 'values', name: raw.name, key: values, limit: valueLimit ?? null, ...note }
    }
    declared(groupBy, 'groupBy')
    if (groupBy === values) {
      errors.push({ path: `${path}.show.groupBy`, message: 'Must be a different field from values.' })
    }
    return {
      type: 'groups',
      name: raw.name,
      key: values,
      groupKey: groupBy,
      groups: groups ?? null,
      limit: valueLimit ?? null,
      ...note,
    }
  }

  const navigation = menu.flatMap((entry, index): StoreNavigationEntryDTO[] => {
    const path = `menu[${index}]`
    if (entry.filter !== undefined || entry.name !== undefined) {
      const { name: entryName, filter, ...rest } = entry
      if (Object.values(rest).some((value) => value !== undefined)) {
        errors.push({ path, message: 'A menu entry with a filter has only a name and the filter.' })
        return []
      }
      if (entryName === undefined || filter === undefined) {
        errors.push({ path, message: 'A menu entry with a filter must have a name and the filter.' })
        return []
      }
      return [{ type: 'products', name: entryName, filter: toRule(filter, path, 'filter', { isLink: true }) ?? {} }]
    }
    if (!hasOneTarget(entry)) {
      errors.push({ path, message: 'Must be one of "category: <handle>" or "collection: <handle>".' })
      return []
    }
    const target = toTarget(entry, path)
    const sections = (entry.sections ?? [])
      .map((raw, sectionIndex) => toSection(raw, `${path}.sections[${sectionIndex}]`, target.type))
      .filter((found) => found !== null)
    if (!entry.footer) return [{ ...target, sections }]
    const footer = entry.footer
      .map((raw, linkIndex) => toLink(raw, `${path}.footer[${linkIndex}]`))
      .filter((found) => found !== null)
    return [{ ...target, sections, footer }]
  })

  /** Each entry of `list` once, ignoring case, reporting a repeat at `<at>[<index>]<suffix>`. */
  const once = <T>(list: T[], identity: (item: T) => string, at: string, suffix: string, what: string) => {
    const seen = new Set<string>()
    list.forEach((item, index) => {
      const value = identity(item)
      if (seen.has(value.toLowerCase())) {
        errors.push({ path: `${at}[${index}]${suffix}`, message: `${what} "${value}" is listed more than once.` })
      }
      seen.add(value.toLowerCase())
    })
  }
  once(search.popular, (term) => term, 'search.popular', '', 'The search')
  once(search.trending, (model) => model.name, 'search.trending', '.name', 'The model')
  const searchStructure: StoreSearchDTO = {
    popular: search.popular,
    trending: search.trending.map((raw, index) => ({
      name: raw.name,
      filter: toRule(raw.filter, `search.trending[${index}]`, 'filter') ?? {},
      note: raw.note ?? null,
    })),
  }

  filters?.forEach((filterKey, index) => {
    const path = `filters[${index}]`
    if (filters.indexOf(filterKey) < index) {
      errors.push({ path, message: `The filter "${filterKey}" is listed more than once.` })
      return
    }
    if (filterKey === SALE_FILTER_KEY) return
    if (filterKey.startsWith(OPTION_FILTER_PREFIX)) {
      if (filterKey.slice(OPTION_FILTER_PREFIX.length).trim() === '') {
        errors.push({ path, message: 'Must name the option, like "option.Size".' })
      }
      return
    }
    const declaredField = metafields.find((metafield) => metafield.key === filterKey)
    if (!declaredField) {
      errors.push({ path, message: `No field in the file has the key "${filterKey}".` })
      return
    }
    if (!declaredField.filterable) {
      errors.push({ path, message: `The field "${filterKey}" is not a filter; it needs filterable: true.` })
    }
  })

  const subline = rawCard?.subline
  if (subline !== undefined) {
    const parsedSubline = parseSublineTemplate(subline)
    if ('error' in parsedSubline) errors.push({ path: 'card.subline', message: parsedSubline.error })
    else {
      for (const sublineKey of sublineKeys(parsedSubline.template)) {
        if (keys.has(sublineKey) || (SUBLINE_BUILTIN_PLACEHOLDERS as readonly string[]).includes(sublineKey)) continue
        errors.push({
          path: 'card.subline',
          message: `No field in the file has the key "${sublineKey}", and it is not {type} or {brand}.`,
        })
      }
    }
  }

  related?.forEach(({ key: matchKey }, index) => {
    const path = `related[${index}].key`
    if (related.findIndex((match) => match.key === matchKey) < index) {
      errors.push({ path, message: `The match "${matchKey}" is listed more than once.` })
      return
    }
    if (matchKey.startsWith(OPTION_FILTER_PREFIX)) {
      if (matchKey.slice(OPTION_FILTER_PREFIX.length).trim() === '') {
        errors.push({ path, message: 'Must name the option, like "option.Size".' })
      }
      return
    }
    if (RELATED_BUILTIN_KEYS.includes(matchKey) || keys.has(matchKey)) return
    errors.push({
      path,
      message: `No field in the file has the key "${matchKey}", and it is not category, type, brand or option.<Title>.`,
    })
  })

  if (errors.length > 0) return fail(errors)
  return {
    structure: {
      metafields,
      categories,
      collections,
      options,
      menu: navigation,
      search: searchStructure,
      filters: filters ?? null,
      card: { subline: subline ?? null, listSeparator: rawCard?.listSeparator ?? DEFAULT_LIST_SEPARATOR },
      related: related ?? null,
    },
    errors: [],
  }
}

function fail(errors: CatalogStructureErrorDTO[]): ParsedCatalogStructure {
  return { structure: null, errors }
}

/** `['categories', 0, 'children', 1, 'handle']` → `categories[0].children[1].handle`. */
function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((formatted, key) => {
    if (typeof key === 'number') return `${formatted}[${key}]`
    return formatted ? `${formatted}.${String(key)}` : String(key)
  }, '')
}
