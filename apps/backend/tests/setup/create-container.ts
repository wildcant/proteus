/**
 * Bootstraps the real DI container — every module, the link service, the workflow engine — with
 * no HTTP surface around it. `createApi` builds on this; workflow and service tests use it
 * directly, since a listening server would be scaffolding they never touch.
 */

import type { InputConfig } from '@core/config/types.js'
import type { DbProvider } from '@core/db/ports.js'
import type { Logger } from '@core/types/logger.js'
import type { AwilixContainer } from 'awilix'
import { bootstrapContainer } from '../../src/container.js'
import type { Database } from '../../src/schema.type.js'

/** What tests annotate with, so no test file imports awilix to name the thing it was handed. */
export type TestContainer = AwilixContainer

export type CreateContainerOptions = {
  /** Config overrides, e.g. authVerificationsPerActor. */
  config?: InputConfig
  /** Runs after the container is built — the place to register a fake provider or override a
   *  registration for this test. A throw here disposes the container rather than leaking it. */
  register?: (container: TestContainer) => void | Promise<void>
}

export type CreatedContainer = {
  container: TestContainer
  /** Idempotent. The `createTestContainer` fixture calls it; `createApi` composes it. */
  close: () => Promise<void>
}

export async function createTestContainer(
  deps: { getDb: () => Database; logger: Logger },
  options: CreateContainerOptions = {},
): Promise<CreatedContainer> {
  const { getDb, logger } = deps

  const dbProvider: DbProvider = {
    getDb,
    withConnection: (fn) => fn(),
    shutdown: async () => {
      // The pool belongs to db-setup.ts and outlives every container built here.
    },
  }

  const container = await bootstrapContainer({ logger, dbProvider, config: options.config })

  let closed = false
  const close = async () => {
    if (closed) return
    closed = true
    await container.dispose()
  }

  try {
    await options.register?.(container)
  } catch (error) {
    // Otherwise a container — and its twelve modules — leaks for every failed setup.
    await close()
    throw error
  }

  return { container, close }
}
