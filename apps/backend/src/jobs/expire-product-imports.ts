import type { AppContainer } from '../core/types/container.js'
import { CronExpression } from '../core/types/cron-expression.js'
import type { JobDefinition } from '../core/types/scheduler.js'
import { ContainerRegistrationKeys } from '../core/utils/container.js'
import { Modules } from '../core/utils/modules-definition.js'

/**
 * Expires product import previews nobody confirmed within the hour, and deletes the CSV and chunk
 * files each one left in storage. A job is marked first and its files go after, so a deletion that
 * fails leaves an expired job with stray files rather than a confirmable job with missing ones.
 */
async function expireProductImports(container: AppContainer) {
  const productService = container.resolve(Modules.PRODUCT)
  const fileService = container.resolve(Modules.FILE)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const expired = await productService.expireProductImports()
  if (expired.length === 0) return

  await fileService
    .deleteFiles(expired.flatMap((job) => [job.fileId, ...job.chunks]))
    .catch((error) => logger.error(error))
  logger.info(`[expire-product-imports] Expired ${expired.length} product import preview(s)`)
}

export const config: JobDefinition = {
  name: 'expire-product-imports',
  schedule: CronExpression.EVERY_10_MINUTES,
  handler: expireProductImports,
}
