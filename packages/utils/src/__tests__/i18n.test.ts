import { describe, expect, expectTypeOf, it } from 'vitest'
import { i18n, type Msgid } from '../i18n.ts'

/** Stands in for `AppError`'s `message`: the one place a plain string must not get through. */
function requireMsgid(message: Msgid): Msgid {
  return message
}

describe('i18n.t', () => {
  it('returns the English text unchanged, since that text is the catalog id', () => {
    expect(i18n.t('Product {id} was not found')).toBe('Product {id} was not found')
  })

  it('brands the result as a Msgid that still reads as a string', () => {
    expectTypeOf(i18n.t('x')).toEqualTypeOf<Msgid>()
    expectTypeOf(i18n.t('x')).toExtend<string>()
    expect(requireMsgid(i18n.t('x'))).toBe('x')
  })

  it('refuses a bare string where a Msgid is required', () => {
    // @ts-expect-error — an unmarked string never reaches the catalog, so tsc must reject it here
    expect(requireMsgid('x')).toBe('x')
  })
})
