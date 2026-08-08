import type { AwilixContainer } from 'awilix'
import { asValue } from 'awilix'
import type {
  NotificationChannel,
  NotificationModuleOptions,
  NotificationProviderConfig,
} from '../../../core/types/notification/common.js'
import type { AbstractNotificationProviderService } from '../../../core/utils/abstract-notification-provider.js'
import { env } from '../../../env.js'
import { NotificationProviderService } from '../services/notification-provider-service.js'

// biome-ignore lint/suspicious/noExplicitAny: provider constructors accept varied dependency shapes
type ProviderConstructor = (new (...args: any[]) => AbstractNotificationProviderService) & { identifier: string }

const PROVIDER_REGISTRATION_PREFIX = 'np_'

export function computeProviderConfigs(
  configs?: NotificationProviderConfig[],
): { id: string; name: string; channels: NotificationChannel[] }[] {
  const result: { id: string; name: string; channels: NotificationChannel[] }[] = []
  if (!configs) return result

  for (const config of configs) {
    for (const ServiceClass of config.resolve.services) {
      const Klass = ServiceClass as ProviderConstructor
      result.push({
        id: config.id,
        name: Klass.identifier,
        channels: config.channels,
      })
    }
  }
  return result
}

export function seedProviders(providerService: NotificationProviderService, configs?: NotificationProviderConfig[]) {
  const providerConfigs = computeProviderConfigs(configs)
  const activeIds = providerConfigs.map((provider) => provider.id)
  return Promise.all([
    providerService.upsert(providerConfigs.map((provider) => ({ ...provider, isEnabled: true }))),
    providerService.disableRemovedProviders(activeIds),
  ])
}

export async function loadProviders({
  container,
  options,
}: {
  container: AwilixContainer
  options?: Record<string, unknown>
}): Promise<void> {
  const opts = options as NotificationModuleOptions | undefined

  // Validate one-provider-per-channel and register providers in DI
  const channelAssignments = new Map<string, string>()

  if (opts?.providers) {
    for (const config of opts.providers) {
      for (const ServiceClass of config.resolve.services) {
        const Klass = ServiceClass as ProviderConstructor
        if (!Klass.identifier) {
          throw new Error(`Provider class ${Klass.name} is missing static "identifier" property.`)
        }

        // Validate one-provider-per-channel
        for (const channel of config.channels) {
          const existing = channelAssignments.get(channel)
          if (existing) {
            throw new Error(
              `Channel "${channel}" is already assigned to provider "${existing}". Cannot also assign to "${Klass.identifier}_${config.id}".`,
            )
          }
          channelAssignments.set(channel, `${Klass.identifier}_${config.id}`)
        }

        // Register provider instance in DI
        const instance = new Klass(container.cradle, config.options ?? {})
        container.register({ [`${PROVIDER_REGISTRATION_PREFIX}${config.id}`]: asValue(instance) })
      }
    }
  }

  // Register NotificationProviderService
  const providerService = new NotificationProviderService({
    container,
    notificationProviderRepository: container.resolve('notificationProviderRepository'),
    logger: container.resolve('logger'),
  })
  container.register({ notificationProviderService: asValue(providerService) })

  // Upsert providers to DB and disable removed ones (skip on workerd)
  if (env.RUNTIME !== 'workerd') {
    await seedProviders(providerService, opts?.providers)
  }
}
