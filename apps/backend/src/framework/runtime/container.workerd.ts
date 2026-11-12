/** Workers entry point — per-request connections, console logger, Cloudflare Queues events. */

import { appConfigInput } from '../../config.js'
import { bootstrapContainer } from '../../container.js'
import type { DbProvider } from '../../core/db/ports.js'
import { createCloudflareQueuesEventBus, type QueuedEvent } from '../event-bus/cloudflare-queues-adapter.js'
import { subscriberRegistry } from '../event-bus/registry.js'
import { ConsoleLogger } from '../logger/console-logger.js'

const logger = new ConsoleLogger()

/**
 * A function rather than a module-level container, because building one needs things only the
 * runtime can hand over: the queue binding, and the database connection string Hyperdrive issues.
 *
 * A binding is a live object workerd constructs from `wrangler.jsonc`. It is never serialised into
 * one, so it cannot arrive through `.env.workerd` or any other environment source however
 * `nodejs_compat` is set — the kind of thing that reads as configured and fails at the first
 * publish. It comes from `import { env } from 'cloudflare:workers'` at the composition root, and
 * that import stays out of this file so the container keeps being buildable by anything that has a
 * binding to pass.
 */
export function createWorkerdContainer(deps: { events: Queue<QueuedEvent> | undefined; dbProvider: DbProvider }) {
  return bootstrapContainer({
    logger,
    dbProvider: deps.dbProvider,
    config: {
      /**
       * Spread from `appConfigInput` because passing a bare `projectConfig` would drop the http
       * settings and silently turn off customer email verification. The bus adapter is the derived
       * default on this runtime and is named anyway: what a deploy runs on should be readable here
       * rather than inferred from `RUNTIME` two files away.
       */
      ...appConfigInput,
      projectConfig: { ...appConfigInput.projectConfig, eventBus: { adapter: 'cloudflare-queues' } },
    },
    // The container is offered and not taken: the producer only puts messages on a queue, and it is
    // the consumer in `index.workerd.ts` that hands a container to a subscriber, one batch later.
    // The logger is taken, because `emit` never rejects — a send it could not make is a log line and
    // nothing else.
    createEventBusAdapter: () =>
      createCloudflareQueuesEventBus({ queue: deps.events, registry: subscriberRegistry, logger }),
  })
}
