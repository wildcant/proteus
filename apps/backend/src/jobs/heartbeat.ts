import type { AppContainer } from '../core/types/container.js'
import { CronExpression } from '../core/types/cron-expression.js'
import type { JobDefinition } from '../core/types/scheduler.js'
import { ContainerRegistrationKeys } from '../core/utils/container.js'

function greetingJob(container: AppContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  logger.info(`[Heartbeat] Greeting! ${new Date().toISOString()}`)
}

export const config: JobDefinition = {
  name: 'heartbeat',
  schedule: CronExpression.EVERY_MINUTE,
  handler: greetingJob,
  disabled: true,
}
