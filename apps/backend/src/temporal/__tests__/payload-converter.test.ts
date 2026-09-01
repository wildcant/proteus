import { BigNumber } from '@core/db/bignum.js'
import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { CartDTO, CartLineItemDTO } from '@core/types/cart/common.js'
import type { OrderDTO } from '@core/types/order/common.js'
import { bigNumberToString, dateToIso } from '@proteus/http-schemas/common'
import type { Payload } from '@temporalio/common'
import { describe, expect, it } from 'vitest'
import { payloadConverter } from '../payload-converter.js'

/**
 * The `__p` keys below are the wire format, not TypeScript identifiers, so they are written as
 * literals rather than through the converter's own constant — a test that borrowed the constant
 * would keep passing if the tag key changed, which is the one thing it is here to catch.
 * `biome.json` turns off `useNamingConvention` for this file for exactly that reason.
 */

const createdAt = new Date('2024-03-05T09:12:33.456Z')
const updatedAt = new Date('2024-03-06T10:00:00.000Z')

const cart: CartDTO = {
  id: 'cart_01',
  regionId: 'reg_01',
  customerId: null,
  salesChannelId: null,
  email: 'shopper@example.com',
  currencyCode: 'usd',
  completedAt: null,
  createdAt,
  updatedAt,
  deletedAt: null,
}

const lineItem: CartLineItemDTO = {
  id: 'li_01',
  cartId: 'cart_01',
  title: 'Hoodie',
  subtitle: null,
  thumbnail: null,
  quantity: 2,
  variantId: 'var_01',
  productId: 'prod_01',
  productTitle: 'Hoodie',
  productDescription: null,
  productSubtitle: null,
  productType: null,
  productHandle: 'hoodie',
  variantSku: 'HOOD-01',
  variantBarcode: null,
  variantTitle: 'M / Black',
  variantOptionValues: null,
  requiresShipping: true,
  isDiscountable: true,
  isGiftcard: false,
  isTaxInclusive: false,
  compareAtUnitPrice: null,
  unitPrice: new BigNumber('19.99'),
  createdAt,
  updatedAt,
  deletedAt: null,
}

const order: OrderDTO = {
  id: 'order_01',
  displayId: 42,
  status: 'pending',
  fulfillmentStatus: 'unfulfilled',
  email: 'shopper@example.com',
  customerId: 'cus_01',
  currencyCode: 'usd',
  canceledAt: null,
  createdAt,
  updatedAt,
  deletedAt: null,
}

/** 20 significant digits — past what a JS float can hold without rounding. */
const wideBigNumber = new BigNumber('12345678901234567890')

const roundTrips: { name: string; value: unknown }[] = [
  { name: 'CartDTO', value: cart },
  { name: 'CartLineItemDTO', value: lineItem },
  { name: 'OrderDTO', value: order },
  { name: 'a whole cart with its line items', value: { cart, items: [lineItem, { ...lineItem, id: 'li_02' }] } },
  { name: 'null', value: null },
  { name: 'a Date nested inside an array', value: [createdAt, updatedAt] },
  { name: 'a BigNumber with 20 significant digits', value: wideBigNumber },
  { name: 'an empty object', value: {} },
  { name: 'an empty array', value: [] },
  {
    name: 'a deeply nested mix',
    value: {
      totals: { cartTotal: new BigNumber('-0.000001'), history: [{ at: createdAt, amount: new BigNumber('0') }] },
      meta: { empty: {}, none: null, list: [], flags: [true, false], counts: [0, -1, 1.5] },
    },
  },
]

class Money {}

const unsupported: { name: string; value: unknown; message: string }[] = [
  {
    name: 'a Map',
    value: { items: [{ unitPrice: new Map() }] },
    message: 'step output at .items[0].unitPrice: unsupported type Map',
  },
  { name: 'a class instance', value: { total: new Money() }, message: 'step output at .total: unsupported type Money' },
  {
    name: 'a function',
    value: { onDone: () => undefined },
    message: 'step output at .onDone: unsupported type function',
  },
  { name: 'a Symbol', value: { tag: Symbol('tag') }, message: 'step output at .tag: unsupported type symbol' },
  { name: 'the payload itself', value: new Map(), message: 'step output at <root>: unsupported type Map' },
  {
    name: 'a number JSON cannot hold',
    value: { lines: [{ quantity: Number.NaN }] },
    message: 'step output at .lines[0].quantity: unsupported number NaN',
  },
  {
    name: 'an undefined array element',
    value: { lines: [undefined] },
    message: 'step output at .lines[0]: unsupported type undefined in array',
  },
  {
    name: 'a value already using the tag key',
    value: { payload: { __p: 'date', v: 'spoofed' } },
    message: "step output at .payload: object uses the reserved key '__p'",
  },
]

function roundTrip<T>(value: T): T {
  return payloadConverter.fromPayload(payloadConverter.toPayload(value))
}

/** The JSON the converter actually puts on the wire, so the tagged encoding is asserted directly. */
function encoded(value: unknown): unknown {
  const { data }: Payload = payloadConverter.toPayload(value)
  return JSON.parse(new TextDecoder().decode(data ?? new Uint8Array()))
}

/**
 * Hand-built wire payload. The encoder rejects `__p` in user data, so a malformed tag can only be
 * produced by writing the bytes directly — which is also the realistic case: history written by an
 * older or wrongly-configured worker.
 */
function wirePayload(json: unknown): Payload {
  const encoder = new TextEncoder()
  return { metadata: { encoding: encoder.encode('json/plain') }, data: encoder.encode(JSON.stringify(json)) }
}

describe('payloadConverter', () => {
  it.each(roundTrips)('round-trips $name', ({ value }) => {
    // toStrictEqual, not toEqual: a decoded BigNumber that came back as a plain `{s,e,c}` object
    // is exactly the corruption this converter exists to prevent, and toEqual would accept it.
    expect(roundTrip(value)).toStrictEqual(value)
  })

  it('returns instances, not their JSON shadows', () => {
    const decoded = roundTrip(lineItem)

    expect(decoded.createdAt).toBeInstanceOf(Date)
    expect(decoded.createdAt.getTime()).toBe(createdAt.getTime())
    expect(BigNumber.isBigNumber(decoded.unitPrice)).toBe(true)
    expect(decoded.unitPrice.toFixed()).toBe('19.99')
  })

  it.each(unsupported)('throws on $name', ({ value, message }) => {
    expect(() => payloadConverter.toPayload(value)).toThrowError(message)
  })

  it('throws AppError, so a failed conversion classifies like every other backend error', () => {
    try {
      payloadConverter.toPayload(new Map())
      expect.unreachable('converter accepted a Map')
    } catch (error) {
      expect(AppError.isError(error)).toBe(true)
      expect(error).toMatchObject({ type: ErrorTypes.INVALID_DATA })
    }
  })

  // The one thing that keeps this converter and the HTTP wire format from drifting apart: both
  // paths must render the same value into the same bytes.
  describe('matches the http-schemas encoding', () => {
    it('encodes a Date exactly as dateToIso does', () => {
      expect(encoded(createdAt)).toStrictEqual({ __p: 'date', v: dateToIso.parse(createdAt) })
    })

    it('encodes a BigNumber exactly as bigNumberToString does', () => {
      expect(encoded(lineItem.unitPrice)).toStrictEqual({
        __p: 'bignum',
        v: bigNumberToString.parse(lineItem.unitPrice),
      })

      // Pinned literal as well as the parity check: 20 significant digits is past what a float
      // holds, so this is what catches a value that took a detour through Number().
      expect(encoded(wideBigNumber)).toStrictEqual({ __p: 'bignum', v: '12345678901234567890' })
      expect(bigNumberToString.parse(wideBigNumber)).toBe('12345678901234567890')
    })
  })

  describe('rejects a payload it cannot decode', () => {
    it.each([
      { name: 'an unknown tag', wire: { at: { __p: 'instant', v: '2024-01-01' } }, message: "unknown tag 'instant'" },
      {
        name: 'a non-string value',
        wire: { at: { __p: 'date', v: 17 } },
        message: "tagged 'date' value must carry a string 'v'",
      },
      {
        name: 'an unparseable date',
        wire: { at: { __p: 'date', v: 'yesterday' } },
        message: "invalid date 'yesterday'",
      },
    ])('throws on $name', ({ wire, message }) => {
      expect(() => payloadConverter.fromPayload(wirePayload(wire))).toThrowError(`step payload at .at: ${message}`)
    })
  })
})
