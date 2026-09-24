import { Modules } from '@core/utils/modules-definition.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import { authHeader } from '@tests/utils/auth-header.js'
import adminUserDefinitions from '../../definitions.js'
import type * as meRoutes from '../route.js'

/**
 * A staff member's own Locale: the admin renders in it, and only they set it, from the account
 * menu. The picker offers every sellable market's Locale and `en-US` always.
 */

let api: TestApi
let userId: string

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: adminUserDefinitions, namespaceAuth: true })
  const user = await api.container
    .resolve(Modules.USER)
    .createUser({ email: 'staff@example.com', name: 'Staff', locale: 'en-US' })
  userId = user.id
})

const getMe = (headers?: Record<string, string>) =>
  api.get<typeof meRoutes.GetOutput>('/admin/users/me', undefined, {
    headers: { ...authHeader('user', userId), ...headers },
  })

const updateMe = (body: object, headers?: Record<string, string>) =>
  api.patch<typeof meRoutes.PatchOutput>('/admin/users/me', body, {
    headers: { ...authHeader('user', userId), ...headers },
  })

test.describe('a staff member Locale', () => {
  test('starts as en-US, and en-US is offered even when no market sells in it', async ({ expect }) => {
    const response = await getMe()

    expect(response.status).toBe(200)
    expect(response.body.user.locale).toBe('en-US')
    expect(response.body.locales).toEqual(['en-US'])
  })

  test('offers every sellable market Locale and saves the one picked', async ({ expect, factories }) => {
    const region = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.country({ id: 'co', displayName: 'Colombia', regionId: region.id, localeCode: 'es-CO' })

    expect((await getMe()).body.locales).toEqual(['en-US', 'es-CO'])

    const response = await updateMe({ locale: 'es-CO' })

    expect(response.status).toBe(200)
    expect(response.body.user.locale).toBe('es-CO')
    expect((await getMe()).body.user.locale).toBe('es-CO')
  })

  test('refuses a Locale the picker does not offer, in the request language', async ({ expect }) => {
    const response = await updateMe({ locale: 'fr-FR' }, { 'x-proteus-locale': 'es-CO' })

    expect(response.status).toBe(400)
    expect((response.body as unknown as ApiErrorBody).message).toBe('fr-FR no es un idioma que ofrezca el panel')
  })
})
