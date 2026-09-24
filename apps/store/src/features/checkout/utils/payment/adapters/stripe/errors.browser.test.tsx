import { setupI18n } from '@lingui/core'
import { describe, expect, it } from 'vitest'
import { messages as esMessages } from '../../../../../../locales/es.po'
import { customerMessageForStripeError } from './errors'

// A browser test only because `errors.ts` marks its copy with the Lingui macro, which only this
// project's Vite pipeline compiles.
const en = setupI18n({ locale: 'en', messages: { en: {} } })
const es = setupI18n({ locale: 'es', messages: { es: esMessages } })

describe('customerMessageForStripeError', () => {
  it('says our own copy in the page language', () => {
    expect(customerMessageForStripeError(null, es)).toBe(
      'No pudimos procesar tu pago. Inténtalo de nuevo o usa otra tarjeta.',
    )
    // biome-ignore lint/style/useNamingConvention: the Stripe wire field
    const lostCard = { type: 'card_error' as const, code: 'card_declined', decline_code: 'lost_card' }
    expect(customerMessageForStripeError(lostCard, es)).toBe(
      'Tu tarjeta fue rechazada. Prueba con otra tarjeta o comunícate con tu banco.',
    )
    expect(
      customerMessageForStripeError(
        { type: 'invalid_request_error', code: 'payment_intent_authentication_failure' },
        es,
      ),
    ).toBe('No pudimos autenticar tu tarjeta con tu banco. Inténtalo de nuevo o usa otra tarjeta.')
  })

  it('keeps the English source text for an English page', () => {
    expect(customerMessageForStripeError({ type: 'api_error', message: 'Invalid API Key provided' }, en)).toBe(
      'We could not process your payment. Please try again or use a different card.',
    )
  })

  it("passes Stripe's own message through, already in the Elements locale", () => {
    const message = 'El número de tu tarjeta es incorrecto.'
    expect(customerMessageForStripeError({ type: 'card_error', code: 'incorrect_number', message }, es)).toBe(message)
  })
})
