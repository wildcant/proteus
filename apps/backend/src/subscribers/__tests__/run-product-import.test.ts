import { buildEvent } from '@core/event-bus/events.js'
import { defineSubscriber } from '@core/event-bus/types.js'
import type { TestContainer } from '@tests/setup/create-container.js'
import { test } from '@tests/setup/test-extend.js'
import { config } from '../run-product-import.js'

/**
 * The subscriber on its own — what one delivery of `product.import_confirmed` does. That the confirm
 * route publishes it, and the whole preview-to-products arc, is
 * `api/admin/product-imports/__tests__/product-import.api.test.ts`.
 */

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

function deliver(id: string): Promise<void> {
  return defineSubscriber(config).handler({
    event: buildEvent('product.import_confirmed', { id }, config.name),
    container,
  })
}

test.describe('the run-product-import subscriber', () => {
  test('a redelivery once the run is over imports nothing again and notifies once', async ({ expect, service }) => {
    const operator = await service.create.operator(container, ['product.create'])
    const productImport = await service.create.confirmedProductImport(container, { createdBy: operator.id })

    await deliver(productImport.id)
    await deliver(productImport.id)

    const finished = await service.read.productImport(container, productImport.id)
    const handle = finished.summary.firstProduct?.handle ?? ''
    expect(finished).toMatchObject({ status: 'completed', created: 1, skipped: 0, failed: 0 })
    expect(await service.read.products(container, { handle })).toHaveLength(1)
    expect(await service.read.notifications(container, { to: operator.email })).toHaveLength(1)
    expect(await service.read.fileExists(container, finished.chunks[0] ?? '')).toBe(false)
  })

  test('marks the job failed, and says so, when no product made it in', async ({ expect, service, dto }) => {
    const operator = await service.create.operator(container, ['product.create'])
    // Nothing listens on port 1, so the image download fails and the product with it.
    const product = dto.generate.importedProduct({ imageUrls: ['http://127.0.0.1:1/missing.png'] })
    const productImport = await service.create.confirmedProductImport(container, {
      products: [product],
      createdBy: operator.id,
    })

    await deliver(productImport.id)

    expect(await service.read.productImport(container, productImport.id)).toMatchObject({
      status: 'failed',
      created: 0,
      failed: 1,
      errors: [
        { line: product.line, handle: product.handle, message: expect.stringContaining('could not be downloaded') },
      ],
    })
    expect(await service.read.products(container, { handle: product.handle })).toEqual([])
    expect(await service.read.notifications(container, { to: operator.email })).toEqual([
      expect.objectContaining({ data: expect.objectContaining({ title: 'Product import failed' }) }),
    ])
  })
})
