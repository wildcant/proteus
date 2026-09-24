import { describe, expect, it } from 'vitest'
import { stripeLocaleFor } from './locale'

describe('stripeLocaleFor', () => {
  it('gives Colombia neutral Latin-American Spanish', () => {
    expect(stripeLocaleFor('es-CO')).toBe('es-419')
  })

  it('keeps Spain on peninsular Spanish', () => {
    expect(stripeLocaleFor('es-ES')).toBe('es-ES')
  })

  it('gives the United States English', () => {
    expect(stripeLocaleFor('en-US')).toBe('en')
  })

  it('leaves a language the store has no catalog for to the browser', () => {
    expect(stripeLocaleFor('fr-FR')).toBe('auto')
  })
})
