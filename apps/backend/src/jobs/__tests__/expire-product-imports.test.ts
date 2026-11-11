import type { TestContainer } from '@tests/setup/create-container.js'
import { test } from '@tests/setup/test-extend.js'
import { sql } from 'drizzle-orm'
import { config } from '../expire-product-imports.js'

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

test.describe('the expire-product-imports job', () => {
  test('expires previews older than an hour and deletes their files, leaving fresh ones alone', async ({
    expect,
    getDb,
    service,
  }) => {
    const stale = await service.create.productImport(container)
    const fresh = await service.create.productImport(container)
    await getDb().execute(sql`UPDATE product_import SET created_at = now() - interval '2 hours' WHERE id = ${stale.id}`)

    await config.handler(container)

    expect((await service.read.productImport(container, stale.id)).status).toBe('expired')
    expect(await service.read.fileExists(container, stale.fileId)).toBe(false)
    expect(await service.read.fileExists(container, stale.chunks[0] ?? '')).toBe(false)
    expect((await service.read.productImport(container, fresh.id)).status).toBe('previewed')
    expect(await service.read.fileExists(container, fresh.fileId)).toBe(true)
  })
})
