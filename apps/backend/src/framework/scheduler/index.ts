import type { Logger } from '@core/types/logger.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { type AwilixContainer, asValue } from 'awilix'
import { BullMqCronScheduler } from './bullmq/bullmq-cron-scheduler.js'

export { BullMqCronScheduler } from './bullmq/bullmq-cron-scheduler.js'

export function registerScheduler(container: AwilixContainer, logger: Logger): void {
  const scheduler = new BullMqCronScheduler(logger, container)
  container.register({ [ContainerRegistrationKeys.SCHEDULER]: asValue(scheduler) })
}
