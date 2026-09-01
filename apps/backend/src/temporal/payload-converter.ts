import { stringToBigNumber } from '@proteus/http-schemas/common'
import {
  BinaryPayloadConverter,
  CompositePayloadConverter,
  JsonPayloadConverter,
  type Payload,
  type PayloadConverterWithEncoding,
  UndefinedPayloadConverter,
} from '@temporalio/common'
import { BigNumber } from '../core/db/bignum.js'
import { AppError, ErrorTypes } from '../core/errors/app-error.js'

/**
 * Payload conversion for values that cross the Temporal boundary.
 *
 * Step outputs carry `Date` and `BigNumber` instances — `CartDTO.createdAt` is a `Date`,
 * `CartLineItemDTO.unitPrice` is a `BigNumber`. Temporal's default JSON converter turns the first
 * into a bare string and the second into its `{s,e,c}` internals, so a workflow that reloads a
 * memoized step output gets something that is no longer the type its handler expects. In
 * `complete-cart` that lands in the money path, which is why this converter exists.
 *
 * ## Tagged, not bare
 *
 * A `Date` encodes as `{ __p: 'date', v: <ISO-8601 with offset> }` and a `BigNumber` as
 * `{ __p: 'bignum', v: <decimal string> }`. The tag is the whole point and is deliberately *not*
 * what the HTTP wire format does: `http-schemas` emits a bare ISO string, which is correct
 * outbound because the consumer has a schema telling it which fields are dates. This converter is
 * shape-agnostic and bidirectional — it has no schema — so a bare ISO string would be
 * indistinguishable from an ordinary string field and every string that happened to look like a
 * date would decode as a `Date`. The tag is what makes the round-trip decidable.
 *
 * ## Same format, different mechanism
 *
 * The encodings match `packages/http-schemas/src/common.ts` exactly: ISO-8601 with offset, as
 * `dateToIso` produces, and `BigNumber.toFixed()`, as `bigNumberToString` produces. Only the
 * *format* is shared — those are schema-driven and encode-only, so the mechanism cannot be. The
 * decode half has no such split and reuses `stringToBigNumber` verbatim.
 * `__tests__/payload-converter.test.ts` asserts both encodings are byte-identical to what the
 * `http-schemas` pipelines produce, which is what stops the two paths from drifting.
 *
 * ## Loud on anything else
 *
 * Anything that is neither JSON-safe nor one of the two registered types throws, naming the JSON
 * path of the offending value. Silent degradation is the failure mode this whole file is here to
 * prevent, so a `Map`, a class instance, a function or a `Symbol` is an error, not a `{}`.
 */

const TAG_KEY = '__p'
const DATE_TAG = 'date'
const BIGNUM_TAG = 'bignum'

/** Root of the JSON path, used when the offending value is the payload itself. */
const ROOT_PATH = '<root>'

/**
 * Tags custom types on the way out and untags them on the way back, delegating the actual bytes to
 * Temporal's own JSON converter so the payload keeps the standard `json/plain` encoding.
 */
class TaggedJsonPayloadConverter implements PayloadConverterWithEncoding {
  readonly encodingType = 'json/plain'

  private readonly json = new JsonPayloadConverter()

  toPayload<T>(value: T): Payload | undefined {
    return this.json.toPayload(encodeValue(value, ''))
  }

  fromPayload<T>(payload: Payload): T {
    return decodeValue(this.json.fromPayload(payload), '') as T
  }
}

/**
 * Mirrors Temporal's `DefaultPayloadConverter` — `undefined` and binary keep their dedicated
 * encodings — with the tagging converter standing in for the plain JSON one.
 */
export class ProteusPayloadConverter extends CompositePayloadConverter {
  constructor() {
    super(new UndefinedPayloadConverter(), new BinaryPayloadConverter(), new TaggedJsonPayloadConverter())
  }
}

/**
 * Temporal loads a converter module by path and reads this exact export name, so it is part of the
 * contract rather than a convenience singleton.
 */
export const payloadConverter = new ProteusPayloadConverter()

function encodeValue(value: unknown, path: string): unknown {
  if (value === null) return null

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return value
    case 'number':
      // `JSON.stringify` writes NaN and Infinity as `null`, which is a value change rather than a
      // failure — exactly the silent degradation this converter refuses.
      if (!Number.isFinite(value)) throw encodeError(path, `unsupported number ${value}`)
      return value
    case 'object':
      return encodeObject(value, path)
    default:
      return unsupported(value, path)
  }
}

function encodeObject(value: object, path: string): unknown {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw encodeError(path, 'unsupported type Date (invalid time value)')
    return { [TAG_KEY]: DATE_TAG, v: value.toISOString() }
  }

  if (BigNumber.isBigNumber(value)) {
    // `toFixed()` renders NaN as the string 'NaN', which `stringToBigNumber` then rejects — so the
    // round-trip would fail on decode, far from the code that produced it. Fail here instead.
    if (value.isNaN()) throw encodeError(path, 'unsupported type BigNumber (NaN)')
    return { [TAG_KEY]: BIGNUM_TAG, v: value.toFixed() }
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const itemPath = `${path}[${index}]`
      // An array is positional: `JSON.stringify` writes a hole as `null`, turning "absent" into a
      // value. Unlike an object property (below) there is nothing equivalent to drop.
      if (item === undefined) throw encodeError(itemPath, 'unsupported type undefined in array')
      return encodeValue(item, itemPath)
    })
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== null && prototype !== Object.prototype) return unsupported(value, path)

  if (Object.hasOwn(value, TAG_KEY)) {
    throw encodeError(path, `object uses the reserved key '${TAG_KEY}'`)
  }

  const encoded: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    // Dropped, as `JSON.stringify` does. A reader cannot tell an absent key from one set to
    // `undefined`, so this is the one omission that is not a loss of information.
    if (item === undefined) continue
    encoded[key] = encodeValue(item, `${path}.${key}`)
  }
  return encoded
}

function decodeValue(value: unknown, path: string): unknown {
  if (value === null || typeof value !== 'object') return value

  if (Array.isArray(value)) {
    return value.map((item, index) => decodeValue(item, `${path}[${index}]`))
  }

  const record = value as Record<string, unknown>
  if (Object.hasOwn(record, TAG_KEY)) return decodeTagged(record[TAG_KEY], record.v, path)

  const decoded: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(record)) {
    decoded[key] = decodeValue(item, `${path}.${key}`)
  }
  return decoded
}

function decodeTagged(tag: unknown, raw: unknown, path: string): Date | BigNumber {
  if (typeof raw !== 'string') {
    throw decodeError(path, `tagged '${String(tag)}' value must carry a string 'v'`)
  }

  switch (tag) {
    case DATE_TAG: {
      const date = new Date(raw)
      if (Number.isNaN(date.getTime())) throw decodeError(path, `invalid date '${raw}'`)
      return date
    }
    case BIGNUM_TAG:
      return stringToBigNumber.parse(raw)
    default:
      throw decodeError(path, `unknown tag '${String(tag)}'`)
  }
}

function unsupported(value: unknown, path: string): never {
  throw encodeError(path, `unsupported type ${describeType(value)}`)
}

/** The name a developer would recognise in the error: `Map`, `Foo`, `function`, `symbol`. */
function describeType(value: unknown): string {
  if (typeof value !== 'object' || value === null) return typeof value
  return Object.getPrototypeOf(value)?.constructor?.name ?? 'object'
}

function encodeError(path: string, detail: string): AppError {
  return new AppError({ type: ErrorTypes.INVALID_DATA, message: `step output at ${path || ROOT_PATH}: ${detail}` })
}

function decodeError(path: string, detail: string): AppError {
  return new AppError({ type: ErrorTypes.INVALID_DATA, message: `step payload at ${path || ROOT_PATH}: ${detail}` })
}
