import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { createI18n } from '#/lib/i18n/catalogs'
import { PERMISSION_TITLES } from './permission-titles'

/**
 * Every permission key the backend registers, read from its generated registry. The admin has no
 * typed copy of the keys (`AdminPermission.key` is a plain string), so the registry file is the source.
 */
function registeredPermissionKeys(): string[] {
  const registry = readFileSync(
    new URL('../../../../../backend/src/core/access-control/features.gen.ts', import.meta.url),
    'utf8',
  )
  return [...registry.matchAll(/\{ id: '([^']+)', title: '[^']*' \}/g)].map(([, key]) => key)
}

describe('PERMISSION_TITLES', () => {
  test('names every permission the backend registers, so none falls back to English', () => {
    const keys = registeredPermissionKeys()
    expect(keys.length).toBeGreaterThan(0)
    expect(keys.filter((key) => !(key in PERMISSION_TITLES))).toEqual([])
  })

  test('renders the invite-resend permission in Spanish', async () => {
    const i18n = await createI18n('es')
    expect(i18n._(PERMISSION_TITLES['user.invite.resend'])).toBe('Reenviar invitaciones')
  })
})
