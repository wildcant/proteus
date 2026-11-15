import { asValue } from 'awilix'
import type { AppContainer } from '../../core/types/container.js'
import { ContainerRegistrationKeys } from '../../core/utils/container.js'
import type { HookHandlerDefinition } from '../../core/workflows/hook-handler.js'

/**
 * Puts the hook handlers on a container, keyed by hook name, replacing any it held. `hookStep` and
 * `runHook` read them back from whichever container they are handed, which is what lets a test
 * container run its own handlers. A hook takes one handler; the extension generator rejects a second.
 */
export function registerHookHandlers(container: AppContainer, handlers: readonly HookHandlerDefinition[]): void {
  const byHook = new Map(handlers.map((handler) => [handler.hook, handler]))
  container.register(ContainerRegistrationKeys.HOOK_HANDLERS, asValue(byHook))
}
