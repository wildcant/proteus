import type { SubscriberArgs, SubscriberConfig } from '@core/event-bus/types.js'
import type { ImportedProductDTO, ProductImportOutcomeDTO } from '@core/types/product/common.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { NotificationTemplates } from '@core/utils/notification-templates.js'
import { buildOperatorAlerts } from '@workflows/notification/utils/operator-alert.js'
import { importProductWorkflow } from '@workflows/product/import-product.js'

/**
 * Runs a confirmed product import: every product in the job's chunks, one `import-product`
 * workflow each, its outcome recorded on the job before the next one starts. A product that fails is
 * counted with its error and the run goes on — one bad row never costs the merchant the others.
 *
 * When the last product is in, the job is finished, its files deleted, and the merchant who uploaded
 * it gets a feed entry with the counts.
 *
 * ## Why it is safe to run twice
 *
 * A job that is not `importing` is left alone, so a delivery after the run finished does nothing.
 * One that arrives while the job is still `importing` — a retry after a crash — skips as many
 * products as the job has already recorded, in the same chunk order, and carries on from there. The
 * notification's idempotency key is the job's id, so finishing twice writes one entry.
 */
async function runProductImport({ event, container }: SubscriberArgs<'product.import_confirmed'>) {
  const productService = container.resolve(Modules.PRODUCT)
  const fileService = container.resolve(Modules.FILE)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const job = await productService.retrieveProductImport(event.data.id)
  if (job.status !== 'importing') return

  const recorded = job.created + job.updated + job.skipped + job.failed
  let position = 0
  for (const chunk of job.chunks) {
    const products = JSON.parse((await fileService.getAsBuffer(chunk)).toString('utf8')) as ImportedProductDTO[]
    for (const product of products) {
      position++
      if (position <= recorded) continue
      const outcome = await importProductWorkflow
        .run({ product, overwrite: job.options.overwrite })
        .then(
          ({ created, updated }): ProductImportOutcomeDTO => ({
            outcome: created ? 'created' : updated ? 'updated' : 'skipped',
          }),
        )
        .catch(
          (error: unknown): ProductImportOutcomeDTO => ({
            outcome: 'failed',
            error: {
              line: product.line,
              handle: product.handle,
              message: error instanceof Error ? error.message : String(error),
            },
          }),
        )
      await productService.recordProductImportOutcome(job.id, outcome)
    }
  }

  const finished = await productService.finishProductImport(job.id)
  await fileService.deleteFiles([finished.fileId, ...finished.chunks]).catch((error) => logger.error(error))

  if (!finished.createdBy) return
  const userService = container.resolve(Modules.USER)
  const [user] = await userService.listUsers({ id: finished.createdBy })
  if (!user) return

  const notificationService = container.resolve(Modules.NOTIFICATION)
  await notificationService.createNotifications(
    buildOperatorAlerts([user.email], {
      template: NotificationTemplates.PRODUCT_IMPORT_FINISHED,
      data: {
        title: finished.status === 'failed' ? 'Product import failed' : 'Product import finished',
        description: `${finished.created} created, ${finished.updated} updated, ${finished.skipped} skipped, ${finished.failed} failed.`,
        href: `/products/import?id=${finished.id}`,
        created: finished.created,
        updated: finished.updated,
        skipped: finished.skipped,
        failed: finished.failed,
      },
      triggerType: 'product.import_confirmed',
      resourceType: 'product_import',
      resourceId: finished.id,
      idempotencyKey: `product-import-finished:${finished.id}`,
    }),
  )
}

export const config: SubscriberConfig<'product.import_confirmed'> = {
  name: 'run-product-import',
  event: 'product.import_confirmed',
  handler: runProductImport,
}
