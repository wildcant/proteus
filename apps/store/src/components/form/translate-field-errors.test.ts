import { setupI18n } from '@lingui/core'
import { messages as esMessages } from '@proteus/http-schemas/locales/es'
import { StoreLoginBody } from '@proteus/http-schemas/store'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { translateFieldErrors } from './translate-field-errors'

const es = setupI18n({ locale: 'es', messages: { es: esMessages } })

function issues(schema: z.ZodType, value: unknown) {
  const result = schema.safeParse(value)
  if (result.success) throw new Error('expected a failed parse')
  return result.error.issues
}

describe('translateFieldErrors', () => {
  it('translates a schema message of ours into the page language', () => {
    const value = { email: 'nope', password: 'x' }
    expect(translateFieldErrors(issues(StoreLoginBody, value), es, value)).toEqual([
      { message: 'Ingresa un correo electrónico válido' },
    ])
  })

  it("translates a store schema message through the store's own catalog", () => {
    // A store-local schema marks its message with `msg`, so the issue carries the catalog id.
    const store = setupI18n({ locale: 'es', messages: { es: { ...esMessages, storeId: 'Mensaje de la tienda' } } })
    const value = ''
    expect(translateFieldErrors(issues(z.string().min(1, 'storeId'), value), store, value)).toEqual([
      { message: 'Mensaje de la tienda' },
    ])
  })

  it("re-renders Zod's own default in the page language", () => {
    const [message] = translateFieldErrors(issues(z.string().min(3), 'a'), es, 'a')
    expect(message?.message).not.toBe(issues(z.string().min(3), 'a')[0]?.message)
    expect(message?.message).toMatch(/3/)
  })

  it('passes a message that did not come from a schema through untouched', () => {
    expect(translateFieldErrors([{ message: 'Already worded' }, 'Plain'], es)).toEqual([
      { message: 'Already worded' },
      { message: 'Plain' },
    ])
  })
})
