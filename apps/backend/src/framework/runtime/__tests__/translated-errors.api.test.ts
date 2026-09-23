import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import { vi } from 'vitest'
import { z } from 'zod'

/**
 * A route that always fails with a message from the `@proteus/http-schemas` catalog carrying a
 * value. A plain string, not `i18n.t()`: the extractor scans tests too.
 */
const definitions = [
  {
    method: 'GET',
    matcher: '/store/translated-error',
    auth: 'public',
    operationId: 'translatedError',
    tags: [Tags.COUNTRIES],
    output: z.object({}),
    throws: [ErrorTypes.INVALID_DATA],
    handler: async () => {
      throw new AppError({
        type: ErrorTypes.INVALID_DATA,
        message: 'Use {maximum} characters or fewer',
        values: { maximum: 80 },
      })
    },
  },
  {
    method: 'POST',
    matcher: '/store/validated-body',
    auth: 'public',
    operationId: 'validatedBody',
    tags: [Tags.COUNTRIES],
    input: { body: z.object({ name: z.string().max(3, 'Use {maximum} characters or fewer'), quantity: z.number() }) },
    output: z.object({}),
    throws: [ErrorTypes.INVALID_DATA],
    handler: async () => ({ status: 200, json: {} }),
  },
] satisfies RouteDefinition[]

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions })
})

const fail = (headers?: Record<string, string>) =>
  api.get<ApiErrorBody>('/store/translated-error', undefined, headers ? { headers } : undefined)

test.describe('error responses', () => {
  test('answer in the language x-proteus-locale names, with the values filled in', async ({ expect }) => {
    const response = await fail({ 'x-proteus-locale': 'es-CO' })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe('Usa 80 caracteres o menos')
  })

  test('keep concurrent requests in their own languages', async ({ expect }) => {
    const responses = await Promise.all(
      ['es-CO', 'en-US', 'es-MX', 'en-GB'].map((locale) => fail({ 'x-proteus-locale': locale })),
    )

    expect(responses.map((response) => response.body.message)).toEqual([
      'Usa 80 caracteres o menos',
      'Use 80 characters or fewer',
      'Usa 80 caracteres o menos',
      'Use 80 characters or fewer',
    ])
  })

  test('answer in English on a cold instance, then in the default market language', async ({ expect, factories }) => {
    const region = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.country({ id: 'zz', displayName: 'Andes', regionId: region.id, localeCode: 'es-CO' })
    await factories.create.store({ defaultRegionId: region.id })

    expect((await fail()).body.message).toBe('Use 80 characters or fewer')

    await vi.waitFor(async () => {
      expect((await fail({ 'x-proteus-locale': 'fr-FR' })).body.message).toBe('Usa 80 caracteres o menos')
    })
  })
})

const invalidBody = (headers?: Record<string, string>) =>
  api.post<ApiErrorBody>(
    '/store/validated-body',
    { name: 'Too long', quantity: 'two' },
    headers ? { headers } : undefined,
  )

test.describe('request validation errors', () => {
  test('translate each issue into the header language, placeholders filled', async ({ expect }) => {
    const response = await invalidBody({ 'x-proteus-locale': 'es-CO' })

    expect(response.status).toBe(400)
    expect(response.body.message).toBe(
      'Cuerpo de la solicitud no válido: name: Usa 3 caracteres o menos; quantity: Entrada inválida: se esperaba número, recibido texto',
    )
  })

  test('keep the English message shape', async ({ expect }) => {
    const response = await invalidBody({ 'x-proteus-locale': 'en-US' })

    expect(response.body).toEqual({
      code: 'invalid_request_error',
      type: ErrorTypes.INVALID_DATA,
      message:
        'Invalid request body: name: Use 3 characters or fewer; quantity: Invalid input: expected number, received string',
    })
  })

  test('answer in the default market language without a header', async ({ expect, factories }) => {
    const region = await factories.create.region({ name: 'Colombia', currencyCode: 'cop' })
    await factories.create.country({ id: 'zz', displayName: 'Andes', regionId: region.id, localeCode: 'es-CO' })
    await factories.create.store({ defaultRegionId: region.id })

    await vi.waitFor(async () => {
      expect((await invalidBody()).body.message).toMatch(/^Cuerpo de la solicitud no válido: name: Usa 3 caracteres/)
    })
  })
})
