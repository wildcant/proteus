import { setupI18n } from '@lingui/core'
import { AdminUpdateMe } from '@proteus/http-schemas/admin'
import { messages as esMessages } from '@proteus/http-schemas/locales/es'
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
    const value = { locale: '' }
    expect(translateFieldErrors(issues(AdminUpdateMe, value), es, value)).toContainEqual({
      message: 'Ingresa una configuración regional.',
    })
  })

  it("translates an admin schema message through the admin's own catalog", () => {
    // An admin-local schema marks its message with `msg`, so the issue carries the catalog id.
    const admin = setupI18n({ locale: 'es', messages: { es: { ...esMessages, adminId: 'Mensaje del panel' } } })
    const value = ''
    expect(translateFieldErrors(issues(z.string().min(1, 'adminId'), value), admin, value)).toEqual([
      { message: 'Mensaje del panel' },
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
