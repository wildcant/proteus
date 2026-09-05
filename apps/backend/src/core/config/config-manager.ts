import type { ConfigModule, InputConfig } from './types.js'

const DEFAULT_HTTP_CONFIG: ConfigModule['projectConfig']['http'] = {
  authMethodsPerActor: {
    user: ['emailpass'],
    customer: ['emailpass'],
  },
  authVerificationsPerActor: {},
}

/**
 * A webhook routinely reaches us before the request that caused it has finished, so processing
 * waits long enough for the shopper's own checkout to land first. Three attempts, because the
 * gateway redelivers anyway — this only has to survive the transient failures redelivery would
 * turn into another five minutes of the shopper not seeing their order.
 */
const DEFAULT_WEBHOOK_CONFIG: ConfigModule['projectConfig']['webhooks'] = {
  delayMs: 5000,
  attempts: 3,
  backoffMs: 1000,
}

export class ConfigManager {
  #config: ConfigModule | undefined

  get config(): ConfigModule {
    if (!this.#config) {
      throw new Error('[config] Config not loaded. Call loadConfig() first.')
    }
    return this.#config
  }

  loadConfig(input: InputConfig = {}): ConfigModule {
    const httpInput = input.projectConfig?.http
    const webhookInput = input.projectConfig?.webhooks
    this.#config = {
      projectConfig: {
        http: {
          authMethodsPerActor: httpInput?.authMethodsPerActor ?? DEFAULT_HTTP_CONFIG.authMethodsPerActor,
          authVerificationsPerActor:
            httpInput?.authVerificationsPerActor ?? DEFAULT_HTTP_CONFIG.authVerificationsPerActor,
        },
        webhooks: {
          delayMs: webhookInput?.delayMs ?? DEFAULT_WEBHOOK_CONFIG.delayMs,
          attempts: webhookInput?.attempts ?? DEFAULT_WEBHOOK_CONFIG.attempts,
          backoffMs: webhookInput?.backoffMs ?? DEFAULT_WEBHOOK_CONFIG.backoffMs,
        },
        // No default: an unset engine means "derive it", which only the composition root can do
        // (it is the one thing here that depends on the runtime).
        workflows: { engine: input.projectConfig?.workflows?.engine },
      },
      featureFlags: input.featureFlags ?? {},
    }
    return this.#config
  }
}
