import { i18n } from '@proteus/utils'
import { asValue } from 'awilix'
import { AppError, ErrorTypes } from '../../core/errors/app-error.js'
import type { AppContainer } from '../../core/types/container.js'
import { ContainerRegistrationKeys } from '../../core/utils/container.js'
import type { HookHandlerDefinition } from '../../core/workflows/hook-handler.js'

/**
 * Puts the hook handlers on a container, keyed by hook name, replacing any it held. `hookStep` and
 * `runHook` read them back from whichever container they are handed, which is what lets a test
 * container run its own handlers.
 *
 * The extension generator already rejects a second handler for one hook; this rejects it too,
 * because a test container can be handed a list the generator never saw.
 */
export function registerHookHandlers(container: AppContainer, handlers: readonly HookHandlerDefinition[]): void {
  const byHook = new Map<string, HookHandlerDefinition>()

  for (const handler of handlers) {
    const registered = byHook.get(handler.hook)
    if (registered) {
      throw new AppError({
        type: ErrorTypes.UNEXPECTED_STATE,
        message: i18n.t('Hook "{hook}" has two handlers, from extensions "{first}" and "{second}". A hook takes one.'),
        values: { hook: handler.hook, first: registered.extension, second: handler.extension },
      })
    }
    byHook.set(handler.hook, handler)
  }

  container.register(ContainerRegistrationKeys.HOOK_HANDLERS, asValue(byHook))
}
