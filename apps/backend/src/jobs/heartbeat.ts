import type { AwilixContainer } from 'awilix'
import { CronExpression } from '../core/types/cron-expression.js'
import type { Logger } from '../core/types/logger.js'
import type { JobDefinition } from '../core/types/scheduler.js'
import { ContainerRegistrationKeys } from '../core/utils/index.js'

function greetingJob(container: AwilixContainer) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
  logger.info(`[Heartbeat] Greeting! ${new Date().toISOString()}`)
}

export const config: JobDefinition = {
  name: 'heartbeat',
  schedule: CronExpression.EVERY_MINUTE,
  handler: greetingJob,
}
