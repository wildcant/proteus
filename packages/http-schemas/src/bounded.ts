import { z } from 'zod'
// This module is a public entrypoint (`@proteus/http-schemas/bounded`), so it cannot rely on a
// namespace index having installed `.openapi()` first. The call is idempotent.
import './openapi-setup.js'

/**
 * Bounds for what a client is allowed to send.
 *
 * Every string and array in a request body has to declare a ceiling — an unbounded one is a
 * cheap denial-of-service (`openapi/ruleset.yaml`, `proteus-request-strings-are-bounded` and
 * `proteus-request-arrays-are-bounded`, both `error`). The point of naming the bounds here is
 * that a new field picks a *kind* rather than inventing a number, and raising a ceiling is one
 * edit rather than a search across ~40 schemas.
 *
 * Postgres stores all of these as `text`, so nothing below is a storage limit. They are API
 * guardrails, chosen wide enough that no legitimate payload meets them.
 */
export const MAX_LENGTH = {
  /** `<prefix>_<32 hex>`; the longest prefix in use is `prodoptval_`, giving 43. */
  id: 64,
  /** Machine-readable identifiers a human types: sku, handle, hsCode, provider names. */
  code: 64,
  /** One-line human text: titles, names, address lines. The varchar(255) convention. */
  shortText: 255,
  /** Prose a human writes into a form: descriptions, notes, postal expressions. */
  longText: 4_000,
  /** Free-form blobs the API stores but does not read. */
  textBlob: 8_192,
  /** The de-facto ceiling browsers and CDNs enforce on a URL. */
  url: 2_048,
  /** scrypt hashes the whole input, so an unbounded password is an unbounded hash. */
  password: 128,
  /** Opaque credentials: base64url verification codes (43) and invite JWTs (~300). */
  token: 512,
  /** E.164 tops out at 15 digits; the rest is separators and extensions. */
  phone: 32,
  /** The longest national postcode formats are ~10 characters. */
  postalCode: 32,
  /** ISO 3166-1 alpha-2 — exactly two, as `AdminCreateGeoZone` already required. */
  countryCode: 2,
} as const

/**
 * Bounds for how many of a thing a client may send at once. Three tiers rather than a number
 * per field: the question a new array asks is which of these it is, not what its own limit
 * should be.
 */
export const MAX_ITEMS = {
  /** Distinct dimensions of one thing: a product's options, the files in one upload. */
  small: 20,
  /** The ordinary batch: line items, option values, images, prices. */
  batch: 100,
  /** Machine-generated lists: a variant matrix, a postal-code service zone. */
  bulk: 1_000,
} as const

/** A prefixed id issued by this API, or a provider name that stands in for one. */
export const entityId = z.string().max(MAX_LENGTH.id)

/** A machine-readable code: sku, barcode, handle, hsCode, country of origin, provider key. */
export const machineCode = z.string().max(MAX_LENGTH.code)

/** One line of human text: a title, a name, an address line. */
export const shortText = z.string().max(MAX_LENGTH.shortText)

/** Prose: a description, a note, a postal expression. */
export const longText = z.string().max(MAX_LENGTH.longText)

/** A free-form blob the API stores verbatim. */
export const textBlob = z.string().max(MAX_LENGTH.textBlob)

/** A URL the API stores and later renders or redirects to. */
export const httpUrl = z.string().max(MAX_LENGTH.url)

/** A plaintext password on its way to the hasher. */
export const password = z.string().max(MAX_LENGTH.password)

/** An opaque credential: a verification code, a reset or invite token. */
export const opaqueToken = z.string().max(MAX_LENGTH.token)

/** A telephone number in any format the shopper typed it. */
export const phone = z.string().max(MAX_LENGTH.phone)

/** A postal or ZIP code. */
export const postalCode = z.string().max(MAX_LENGTH.postalCode)

/** An ISO 3166-1 alpha-2 country code. */
export const countryCode = z.string().max(MAX_LENGTH.countryCode)

/**
 * A decimal amount carried as a string so precision survives JSON.
 *
 * `maxLength` is the wrong tool for a number: it would let `9`×40 through and call it bounded.
 * The pattern is the real constraint — 12 integer digits and 8 decimal places, which is more
 * precision than any currency needs and still far short of an amount that costs anything to
 * parse. `format` is what satisfies the ruleset; `pattern` is what enforces it.
 */
export const decimalAmount = z
  .string()
  .regex(/^-?\d{1,12}(\.\d{1,8})?$/, 'Invalid amount')
  .openapi({ format: 'decimal' })
