import type { Logger } from '../types/logger.js'
import type { NotificationProviderSendInput, NotificationProviderSendOutput } from '../types/notification/mutations.js'
import type { INotificationProvider } from '../types/notification/provider.js'

type InjectedDependencies = {
  logger: Logger
}

/**
 * Abstract base class that all notification providers must extend.
 *
 * Subclasses must set a static `identifier` string and override `send()`.
 * The provider's registration key in the DI container is `np_{identifier}_{id}`,
 * where `{id}` comes from the provider configuration.
 *
 * @typeParam TConfig - Shape of the provider's options.
 */
export abstract class AbstractNotificationProviderService<TConfig = Record<string, unknown>>
  implements INotificationProvider
{
  static identifier: string

  protected config: TConfig
  protected logger: Logger

  constructor(container: InjectedDependencies, config: TConfig) {
    this.logger = container.logger
    this.config = config
  }

  async send(_input: NotificationProviderSendInput): Promise<NotificationProviderSendOutput> {
    throw new Error('Method not implemented. Override "send" in your notification provider.')
  }
}
