import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { SpanishI18nTestProvider } from '#/lib/i18n/test-i18n'
import { FloatingLabelInput } from './input'

/**
 * The reveal toggle names the action it takes, so its accessible name changes with every press —
 * and both names are copy a shopper hears, so both go through the page's catalog.
 */
test('names both reveal states in the page language', async () => {
  render(<FloatingLabelInput id="password" label="Contraseña" type="password" />, {
    wrapper: SpanishI18nTestProvider,
  })

  const show = page.getByRole('button', { name: 'Mostrar contraseña' })
  await expect.element(show).toBeVisible()
  await show.click()

  await expect.element(page.getByRole('button', { name: 'Ocultar contraseña' })).toBeVisible()
})
