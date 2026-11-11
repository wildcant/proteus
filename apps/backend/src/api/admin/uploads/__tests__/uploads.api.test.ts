import { AdminCreatePresignedUploadUrl } from '@proteus/http-schemas/admin'
import type { TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import uploadDefinitions from '../definitions.js'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: uploadDefinitions })
})

test.describe('POST /admin/uploads', () => {
  const uploadFile = (fields: Record<string, string>) => {
    const request = api.request.post('/admin/uploads')
    for (const [name, value] of Object.entries(fields)) request.field(name, value)
    return request.attach('files', Buffer.from('a,b\n'), { filename: 'catalogue.csv', contentType: 'text/csv' })
  }

  // The local provider keeps private files apart, under a `private-` key, and serves only public ones.
  test('stores a file public unless the form asks for private', async ({ expect }) => {
    const publicUpload = await uploadFile({})
    const privateUpload = await uploadFile({ access: 'private' })

    expect(publicUpload.status).toBe(201)
    expect(publicUpload.body.files[0].id).not.toMatch(/^private-/)
    expect(privateUpload.status).toBe(201)
    expect(privateUpload.body.files[0].id).toMatch(/^private-/)
  })

  test('rejects an unknown access', async ({ expect }) => {
    const response = await uploadFile({ access: 'secret' })

    expect(response.status).toBe(400)
  })
})

test.describe('POST /admin/uploads/presigned-urls', () => {
  // The pattern was previously anchored only at the start, so a valid prefix
  // carried arbitrary trailing input past validation into MIMEType, which threw
  // a bare TypeError and surfaced as a 500.
  const malformed = [
    'image/png<script>alert(1)</script>',
    'image/png\nX-Injected: 1',
    'image/png/../../etc/passwd',
    'image/',
    'notamime',
    `${'a'.repeat(200)}/png`,
  ]

  for (const mimeType of malformed) {
    test(`rejects ${JSON.stringify(mimeType)} with 400`, async ({ expect }) => {
      const response = await api.post('/admin/uploads/presigned-urls', {
        originalName: 'logo.png',
        mimeType,
        size: 1024,
      })
      expect(response.status).toBe(400)
    })
  }

  test('accepts well-formed MIME types', ({ expect }) => {
    for (const mimeType of ['image/png', 'IMAGE/PNG', 'image/svg+xml', 'application/vnd.api+json']) {
      const result = AdminCreatePresignedUploadUrl.safeParse({ originalName: 'a.png', mimeType, size: 1 })
      expect(result.success, mimeType).toBe(true)
    }
  })

  // Anchoring the pattern also drops parameters. Nothing downstream reads them —
  // the route uses only the subtype — but it is a deliberate tightening.
  test('rejects MIME types carrying parameters', ({ expect }) => {
    const result = AdminCreatePresignedUploadUrl.safeParse({
      originalName: 'a.png',
      mimeType: 'image/png; charset=utf-8',
      size: 1,
    })
    expect(result.success).toBe(false)
  })
})
