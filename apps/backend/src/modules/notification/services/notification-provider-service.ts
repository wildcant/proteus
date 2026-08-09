import type { AwilixContainer } from 'awilix'
import type { Context } from '../../../core/types/context.js'
import type { Logger } from '../../../core/types/logger.js'
import type { NotificationChannel } from '../../../core/types/notification/common.js'
import type {
  NotificationProviderSendInput,
  NotificationProviderSendOutput,
} from '../../../core/types/notification/mutations.js'
import type { INotificationProvider } from '../../../core/types/notification/provider.js'
import type { NotificationProviderRepository } from '../repositories/notification-provider.js'

const PROVIDER_REGISTRATION_PREFIX = 'np_'

type InjectedDependencies = {
  container: AwilixContainer
  notificationProviderRepository: NotificationProviderRepository
  logger: Logger
}

export class NotificationProviderService {
  private container: AwilixContainer
  private notificationProviderRepository: NotificationProviderRepository
  private logger: Logger
  // Providers are only registered at startup and never change at runtime,
  // so we can cache the channel-to-provider mapping for the process lifetime.
  private providersCache: Map<string, string> | null = null

  constructor({ container, notificationProviderRepository, logger }: InjectedDependencies) {
    this.container = container
    this.notificationProviderRepository = notificationProviderRepository
    this.logger = logger
  }

  // -- Channel-to-provider resolution (lazy cache from DB) --

  async resolveProviderForChannel(channel: string): Promise<string | null> {
    if (!this.providersCache) {
      const providers = await this.notificationProviderRepository.find({ isEnabled: true })
      this.providersCache = new Map(providers.flatMap((provider) => provider.channels.map((c) => [c, provider.id])))
    }
    return this.providersCache.get(channel) ?? null
  }

  // -- Provider instance lookup --

  // The DB stores the config-level ID (e.g. "default"); the DI container
  // registers the provider instance under a prefixed key (e.g. "np_default").
  retrieveProvider(providerId: string): INotificationProvider {
    try {
      return this.container.resolve<INotificationProvider>(`${PROVIDER_REGISTRATION_PREFIX}${providerId}`)
    } catch {
      throw new Error(`Notification provider "${providerId}" is not registered.`)
    }
  }

  // -- Delegate send --

  async send(providerId: string, input: NotificationProviderSendInput): Promise<NotificationProviderSendOutput> {
    this.logger.debug(
      `Sending notification via provider "${providerId}" to "${input.to}" on channel "${input.channel}"`,
    )
    const provider = this.retrieveProvider(providerId)
    return provider.send(input)
  }

  // -- Provider table CRUD --

  async upsert(
    providers: { id: string; name: string; isEnabled: boolean; channels: NotificationChannel[] }[],
    context?: Context,
  ): Promise<void> {
    await Promise.all(
      providers.map(async (provider) => {
        const existing = await this.notificationProviderRepository.findById(provider.id, undefined, context)
        if (existing) {
          this.logger.debug(`Updating notification provider "${provider.id}"`)
          await this.notificationProviderRepository.update(
            existing.id,
            { name: provider.name, isEnabled: provider.isEnabled, channels: provider.channels },
            context,
          )
        } else {
          this.logger.debug(`Registering new notification provider "${provider.id}"`)
          await this.notificationProviderRepository.create(provider, context)
        }
      }),
    )
  }

  async disableRemovedProviders(activeIds: string[], context?: Context): Promise<void> {
    const allProviders = await this.notificationProviderRepository.find(undefined, undefined, context)
    const toDisable = allProviders.filter((provider) => provider.isEnabled && !activeIds.includes(provider.id))
    if (toDisable.length > 0) {
      await this.notificationProviderRepository.updateMany(
        toDisable.map((provider) => provider.id),
        { isEnabled: false },
        context,
      )
    }
  }
}
