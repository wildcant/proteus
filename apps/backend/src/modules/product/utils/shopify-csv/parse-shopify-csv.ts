import { Buffer } from 'node:buffer'
import { Readable } from 'node:stream'
import { CsvError, parse } from 'csv-parse'
import type {
  ImportedProductDTO,
  ImportedVariantDTO,
  ProductImportErrorDTO,
  ProductImportSettingsDTO,
} from '../../../../core/types/product/common.js'
import { IMPORT_COLUMNS, type ImportColumn, MARKET_PRICE_HEADER, normalizeHeader, OPTION_COLUMNS } from './columns.js'

const MAX_IMPORT_FILE_BYTES = 15 * 1024 * 1024

export type ParsedShopifyCsv = {
  products: ImportedProductDTO[]
  errors: ProductImportErrorDTO[]
  /** Headers present in the file that the import does not read, as written. */
  ignoredColumns: string[]
}

type CsvSource = AsyncIterable<Uint8Array | string>

/** Where each read column sits in a record, and which currency each price column is in. */
type HeaderMap = {
  index: Partial<Record<ImportColumn, number>>
  prices: Array<{ index: number; currencyCode: string }>
}

/** A product while its rows are still arriving. */
type ProductDraft = ImportedProductDTO & {
  images: Array<{ url: string; position: number | null }>
  combinations: Set<string>
}

const NUMBER = /^-?\d+([.,]\d+)?$/

/**
 * Reads a Shopify-format product CSV into normalized products, one per `URL handle`.
 *
 * Every problem is collected rather than the first one thrown, each with the line it is on — the
 * header is line 1, and a record that spans lines (a quoted description with newlines) is reported at
 * the line it starts on. A file with errors still yields its products, so the preview can show what
 * the rest would do; the job refuses to run until the file is fixed.
 *
 * UTF-8 with or without a BOM, comma- or semicolon-delimited (Spanish-locale spreadsheets export
 * `;`), the delimiter read off the header line.
 */
export async function parseShopifyCsv(
  source: CsvSource,
  settings: ProductImportSettingsDTO,
): Promise<ParsedShopifyCsv> {
  const errors: ProductImportErrorDTO[] = []
  const fail = (line: number, handle: string | null, message: string) => errors.push({ line, handle, message })

  const { head, rest, tooLarge } = await readHead(source)
  const delimiter = detectDelimiter(head.toString('utf8'))
  const input = Readable.from(concat(head, rest))
  const parser = parse({ bom: true, delimiter, info: true, relaxColumnCount: true, relaxQuotes: true })
  input.pipe(parser)

  const drafts = new Map<string, ProductDraft>()
  let header: HeaderMap | null = null
  let ignoredColumns: string[] = []
  let previousEnd = 0

  try {
    for await (const { record, info } of parser as AsyncIterable<{ record: string[]; info: { lines: number } }>) {
      const line = previousEnd + 1
      previousEnd = info.lines
      if (!header) {
        const read = readHeader(record, settings, fail)
        if (!read) return { products: [], errors, ignoredColumns: [] }
        header = read.header
        ignoredColumns = read.ignored
        continue
      }
      if (record.every((field) => field.trim() === '')) continue
      readRow(record, line, header, settings, drafts, fail)
    }
  } catch (error) {
    if (!(error instanceof CsvError)) throw error
    fail(previousEnd + 1, null, `The file could not be read past this line: ${error.message}`)
  } finally {
    input.destroy()
  }

  if (tooLarge()) {
    return {
      products: [],
      errors: [
        { line: 1, handle: null, message: `The file is larger than ${MAX_IMPORT_FILE_BYTES / 1024 / 1024} MB.` },
      ],
      ignoredColumns,
    }
  }
  if (!header) {
    return { products: [], errors: [{ line: 1, handle: null, message: 'The file has no header row.' }], ignoredColumns }
  }

  return { products: [...drafts.values()].map(finishProduct), errors, ignoredColumns }
}

/**
 * Buffers the source up to the end of its first line, so the delimiter can be read before parsing
 * starts. Bytes past the size cap are never handed on; `tooLarge` says whether that happened.
 */
async function readHead(source: CsvSource) {
  const iterator = source[Symbol.asyncIterator]()
  let bytes = 0
  let exceeded = false
  const next = async (): Promise<Buffer | null> => {
    if (exceeded) return null
    const { value, done } = await iterator.next()
    if (done) return null
    const chunk = typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(value)
    bytes += chunk.length
    if (bytes > MAX_IMPORT_FILE_BYTES) {
      exceeded = true
      await iterator.return?.()
      return null
    }
    return chunk
  }

  const headChunks: Buffer[] = []
  while (!headChunks.some((chunk) => chunk.includes(0x0a))) {
    const chunk = await next()
    if (!chunk) break
    headChunks.push(chunk)
  }

  async function* rest(): AsyncGenerator<Buffer> {
    for (let chunk = await next(); chunk; chunk = await next()) yield chunk
  }

  return { head: Buffer.concat(headChunks), rest: rest(), tooLarge: () => exceeded }
}

async function* concat(head: Buffer, rest: AsyncIterable<Buffer>): AsyncGenerator<Buffer> {
  if (head.length > 0) yield head
  yield* rest
}

/** Whichever of `,` and `;` the header line uses more of, outside quotes. Comma on a tie. */
function detectDelimiter(text: string): ',' | ';' {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  let quoted = false
  let commas = 0
  let semicolons = 0
  for (const character of firstLine) {
    if (character === '"') quoted = !quoted
    else if (!quoted && character === ',') commas++
    else if (!quoted && character === ';') semicolons++
  }
  return semicolons > commas ? ';' : ','
}

function readHeader(
  record: string[],
  settings: ProductImportSettingsDTO,
  fail: (line: number, handle: string | null, message: string) => void,
): { header: HeaderMap; ignored: string[] } | null {
  const header: HeaderMap = { index: {}, prices: [] }
  const ignored: string[] = []
  const columnByName = new Map<string, ImportColumn>(
    Object.entries(IMPORT_COLUMNS).flatMap(([column, names]) => names.map((name) => [name, column as ImportColumn])),
  )

  record.forEach((raw, index) => {
    const name = normalizeHeader(raw)
    if (!name) return
    const market = MARKET_PRICE_HEADER.exec(name)?.[1]
    if (market) {
      const currencyCode = settings.marketCurrencies[market.trim()]
      if (currencyCode) header.prices.push({ index, currencyCode })
      else fail(1, null, `The column "${raw.trim()}" names a market the store does not sell in.`)
      return
    }
    const column = columnByName.get(name)
    if (column && header.index[column] === undefined) {
      header.index[column] = index
      if (column === 'price') {
        if (settings.defaultCurrency) header.prices.push({ index, currencyCode: settings.defaultCurrency })
        else fail(1, null, 'The "Price" column needs a default currency, and the store has none.')
      }
      return
    }
    ignored.push(raw.trim())
  })

  const missing = (['title', 'handle'] as const).filter((column) => header.index[column] === undefined)
  if (missing.length > 0) {
    fail(
      1,
      null,
      `The file is missing the ${missing.map((column) => `"${HEADER_LABELS[column]}"`).join(' and ')} column.`,
    )
    return null
  }
  return { header, ignored }
}

const HEADER_LABELS = { title: 'Title', handle: 'URL handle' } as const

function readRow(
  record: string[],
  line: number,
  header: HeaderMap,
  settings: ProductImportSettingsDTO,
  drafts: Map<string, ProductDraft>,
  fail: (line: number, handle: string | null, message: string) => void,
): void {
  const get = (column: ImportColumn) => {
    const index = header.index[column]
    return index === undefined ? '' : (record[index] ?? '').trim()
  }

  const handle = get('handle')
  if (!handle) {
    fail(line, null, 'The row has no URL handle.')
    return
  }
  const report = (message: string) => fail(line, handle, message)

  const existing = drafts.get(handle)
  const product = existing ?? startProduct(handle, line, get, settings, report)
  if (!existing) drafts.set(handle, product)
  else product.rows++

  const imageUrl = get('imageUrl')
  if (imageUrl) {
    if (!isHttpUrl(imageUrl)) report(`The image URL "${imageUrl}" is not an http(s) URL.`)
    const position = get('imagePosition')
    product.images.push({ url: imageUrl, position: position && /^\d+$/.test(position) ? Number(position) : null })
  }

  const prices = header.prices.map(({ index, currencyCode }) => ({ currencyCode, raw: (record[index] ?? '').trim() }))
  const optionValues = OPTION_COLUMNS.slice(0, product.options.length).map(({ value }) => get(value))
  // A later row with nothing variant-like on it only adds an image, which is how Shopify exports a
  // gallery longer than the variant list.
  const isVariantRow =
    !existing || Boolean(get('sku')) || optionValues.some(Boolean) || prices.some((price) => price.raw)
  if (!isVariantRow) return

  product.variants.push(readVariant(line, get, prices, optionValues, product, report))
}

function startProduct(
  handle: string,
  line: number,
  get: (column: ImportColumn) => string,
  settings: ProductImportSettingsDTO,
  report: (message: string) => void,
): ProductDraft {
  const title = get('title')
  if (!title) report('The product has no title.')

  const status = get('status').toLowerCase()
  if (status && !['active', 'draft', 'archived'].includes(status)) {
    report(`The status "${get('status')}" is not one of active, draft or archived.`)
  }

  const optionNames = OPTION_COLUMNS.map(({ name }) => get(name)).filter(Boolean)
  // Shopify's way of saying "no options": a single `Title` option whose one value is `Default Title`.
  const hasNoOptions = optionNames.length === 1 && optionNames[0] === 'Title' && get('option1Value') === 'Default Title'

  return {
    line,
    rows: 1,
    handle,
    title,
    description: get('description') || null,
    status: (status === '' || status === 'active') && settings.publish ? 'published' : 'draft',
    type: get('type') || null,
    tags: readTags(get('tags')),
    options: hasNoOptions ? [] : optionNames.map((title) => ({ title, values: [] })),
    variants: [],
    imageUrls: [],
    images: [],
    combinations: new Set(),
  }
}

/**
 * Every tag is a plain tag, `genero:hombre` included: the structure file's rules read them to place
 * the product in categories and collections, so the import never names a grouping itself.
 */
function readTags(raw: string): string[] {
  return [...new Set(raw.split(',').map((entry) => entry.trim()))].filter(Boolean)
}

/**
 * A variant with a problem is still kept, without the bad value: the file cannot run until it is
 * fixed, but the preview still counts and shows what it holds.
 */
function readVariant(
  line: number,
  get: (column: ImportColumn) => string,
  prices: Array<{ currencyCode: string; raw: string }>,
  optionValues: string[],
  product: ProductDraft,
  report: (message: string) => void,
): ImportedVariantDTO {
  optionValues.forEach((value, index) => {
    if (!value) report(`The variant has no value for the option "${product.options[index]?.title}".`)
  })
  const combination = optionValues.join(' / ')
  if (optionValues.every(Boolean)) {
    if (product.combinations.has(combination)) {
      report(
        product.options.length > 0
          ? `The option combination "${combination}" appears more than once.`
          : 'A product with no options can have only one variant.',
      )
    }
    product.combinations.add(combination)
  }

  const readPrice = ({ currencyCode, raw }: { currencyCode: string; raw: string }) => {
    if (!raw) return []
    const amount = readNumber(raw)
    if (amount === null || amount < 0) {
      report(`The price "${raw}" is not a number.`)
      return []
    }
    return [{ currencyCode, amount }]
  }
  const variantPrices = prices.flatMap(readPrice)

  const rawWeight = get('weight')
  const weight = rawWeight ? readNumber(rawWeight) : null
  if (rawWeight && (weight === null || weight < 0)) report(`The weight "${rawWeight}" is not a number of grams.`)

  const rawQuantity = get('inventoryQuantity')
  const inventoryQuantity = rawQuantity && /^\d+$/.test(rawQuantity) ? Number(rawQuantity) : null
  if (rawQuantity && inventoryQuantity === null)
    report(`The inventory quantity "${rawQuantity}" is not a whole number.`)

  const imageUrl = get('variantImageUrl')
  if (imageUrl && !isHttpUrl(imageUrl)) report(`The variant image URL "${imageUrl}" is not an http(s) URL.`)

  const continueSelling = get('continueSelling').toLowerCase()

  return {
    line,
    sku: get('sku') || null,
    optionValues,
    weight,
    manageInventory: get('inventoryTracker') !== '',
    allowBackorder: continueSelling === 'continue' || continueSelling === 'true',
    inventoryQuantity,
    prices: variantPrices,
    imageUrl: imageUrl && isHttpUrl(imageUrl) ? imageUrl : null,
  }
}

/** Orders the gallery, collects each option's values and drops what was only needed while reading. */
function finishProduct({ images, combinations: _combinations, ...product }: ProductDraft): ImportedProductDTO {
  const ordered = images
    .map((image, order) => ({ ...image, order }))
    .sort(
      (a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) || a.order - b.order,
    )
    .map((image) => image.url)
  const variantImages = product.variants.flatMap((variant) => (variant.imageUrl ? [variant.imageUrl] : []))

  return {
    ...product,
    options: product.options.map((option, index) => ({
      title: option.title,
      values: [...new Set(product.variants.map((variant) => variant.optionValues[index] ?? ''))].filter(Boolean),
    })),
    imageUrls: [...new Set([...ordered, ...variantImages])],
  }
}

/** A decimal with either separator, since a `;`-delimited file usually writes `9,99`. */
function readNumber(raw: string): number | null {
  const compact = raw.replace(/\s/g, '')
  return NUMBER.test(compact) ? Number(compact.replace(',', '.')) : null
}

function isHttpUrl(value: string): boolean {
  return URL.canParse(value) && ['http:', 'https:'].includes(new URL(value).protocol)
}
