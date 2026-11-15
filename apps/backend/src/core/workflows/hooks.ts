/**
 * Workflow hooks: a named point in a core workflow where a store's extension may replace core's
 * computation with its own. Not webhooks — those are the `/hooks/` API scope.
 *
 * A hook is defined next to the core workflow that runs it, with core's behaviour as its fallback:
 *
 * ```ts
 * export const orderChargesHook = defineHook<OrderChargesInput, OrderCharges>({
 *   name: 'order-charges',
 *   throws: [ErrorTypes.INVALID_DATA] as const,
 *   fallback: async (input, { container }) => computeCoreCharges(input),
 * })
 * ```
 *
 * A workflow runs it as one step, `const charges = await hookStep(ctx, orderChargesHook, input)`,
 * and spreads `...orderChargesHook.throws` into its own `throws`. A route runs it outside a
 * workflow with `runHook(req.scope, orderChargesHook, input)`, and spreads the same list.
 *
 * ## The handler file convention
 *
 * A handler lives in an extension, one per file under `src/extensions/<ext>/hooks/<name>.ts`, as
 * the file's export named `handler`:
 *
 * ```ts
 * export const handler = defineHookHandler(orderChargesHook, {
 *   run: async (input, { container }) => ...,
 *   compensate: async (output, { container }) => ..., // optional
 * })
 * ```
 *
 * The extension generator imports each one under an alias and writes it into the registry's
 * `hookHandlers` with the extension's name added, `{ ...fixtureChargesHandler, extension: 'fixture' }`
 * — the handler never names its own extension, so it cannot name the wrong one. Exactly one handler
 * per hook across all extensions; the generator rejects a second, and so does `registerHookHandlers`.
 *
 * Mechanism — why a hook is always one step, and which handler's compensation runs — is in
 * `src/framework/workflows/README.md#hooks`; how to add one is
 * `standards/rules/backend/workflows/__docs__/hooks.md`.
 */

import { i18n } from '@proteus/utils'
import type { BigNumber } from '../bignumber.js'
import { AppError, ErrorTypes } from '../errors/app-error.js'
import type { AppContainer } from '../types/container.js'
import { ContainerRegistrationKeys } from '../utils/container.js'
import type { HookHandlerDefinition } from './hook-handler.js'
import { type StepContext, type WorkflowContext, WorkflowTerminalError } from './types.js'

/**
 * What a hook may return: what the Temporal payload converter carries — plain JSON, `Date` and
 * `BigNumber` (`src/framework/temporal/payload-converter.ts`). A `Map`, a class instance or a
 * function is a type error here rather than an encode failure in the middle of a checkout.
 */
export type HookValue =
  | string
  | number
  | boolean
  | null
  | Date
  | BigNumber
  | readonly HookValue[]
  | { readonly [key: string]: HookValue | undefined }

export type Hook<TInput, TOutput extends HookValue> = {
  name: string
  /** The error types the hook's handler may raise, for every workflow and route running it to spread. */
  throws: readonly ErrorTypes[]
  /** Core's behaviour, run when no extension registered a handler. */
  fallback: (input: TInput, context: StepContext) => Promise<TOutput>
}

/**
 * @extensionApi The extension and hook API: no core code calls it until a fork does, so the production
 * unused-code pass skips it (`scripts/checks/unused.sh`).
 */
export function defineHook<TInput, TOutput extends HookValue>(config: Hook<TInput, TOutput>): Hook<TInput, TOutput> {
  return config
}

export type HookHandler<TInput, TOutput extends HookValue> = {
  /** The hook's name. One handler per name. */
  hook: string
  run: (input: TInput, context: StepContext) => Promise<TOutput>
  /** Undoes `run` when a later step fails. Never called outside a workflow. */
  compensate?: (output: TOutput, context: StepContext) => Promise<void>
}

/**
 * @extensionApi The extension and hook API: no core code calls it until a fork does, so the production
 * unused-code pass skips it (`scripts/checks/unused.sh`).
 */
export function defineHookHandler<TInput, TOutput extends HookValue>(
  hook: Hook<TInput, TOutput>,
  handler: Omit<HookHandler<TInput, TOutput>, 'hook'>,
): HookHandler<TInput, TOutput> {
  return { hook: hook.name, ...handler }
}

/** The step output: the value, and which extension's handler produced it (`null` for the fallback). */
type HookStepOutput<TOutput> = { handledBy: string | null; value: TOutput }

/**
 * Runs a hook as exactly one step, `hook:<name>`, whether or not a handler is registered — so the
 * step sequence Temporal replays by never depends on which extensions are deployed.
 *
 * The handler is looked up inside the step, from the container the step is handed. Compensation
 * runs the handler's `compensate` only when the handler that produced the output is still the one
 * registered, so a handler added, removed or replaced between the step and its rollback never
 * undoes work it did not do.
 *
 * @extensionApi The extension and hook API: no core code calls it until a fork does, so the production
 * unused-code pass skips it (`scripts/checks/unused.sh`).
 */
export async function hookStep<TInput, TOutput extends HookValue>(
  ctx: WorkflowContext,
  hook: Hook<TInput, TOutput>,
  input: TInput,
): Promise<TOutput> {
  const output = await ctx.step<HookStepOutput<TOutput>>(
    `hook:${hook.name}`,
    async (context) => {
      const handler = registeredHandler(context.container, hook)
      if (!handler) return { handledBy: null, value: await hook.fallback(input, context) }

      try {
        return { handledBy: handler.extension, value: await runHandler(handler, input, context) }
      } catch (error) {
        const declared = declaredError(hook, error)
        // Terminal: a declared error is the handler's verdict, and retrying it only repeats it.
        if (declared) throw new WorkflowTerminalError(declared)
        throw unexpectedHandlerError(hook, handler, error)
      }
    },
    async ({ handledBy, value }, context) => {
      if (handledBy === null) return
      const handler = registeredHandler(context.container, hook)
      if (handler?.extension !== handledBy || !handler.compensate) return
      await (handler.compensate as (output: TOutput, context: StepContext) => Promise<void>)(value, context)
    },
  )
  return output.value
}

/**
 * Runs a hook outside a workflow — a route's preview of what the workflow will store. Only the
 * handler's `run`, never its compensation, so a hook called here must have a handler free of side
 * effects. A declared error is rethrown as is; anything else is an unexpected-state error.
 *
 * @extensionApi The extension and hook API: no core code calls it until a fork does, so the production
 * unused-code pass skips it (`scripts/checks/unused.sh`).
 */
export async function runHook<TInput, TOutput extends HookValue>(
  container: AppContainer,
  hook: Hook<TInput, TOutput>,
  input: TInput,
): Promise<TOutput> {
  const context = { container }
  const handler = registeredHandler(container, hook)
  if (!handler) return hook.fallback(input, context)

  try {
    return await runHandler(handler, input, context)
  } catch (error) {
    throw declaredError(hook, error) ?? unexpectedHandlerError(hook, handler, error)
  }
}

function registeredHandler<TInput, TOutput extends HookValue>(
  container: AppContainer,
  hook: Hook<TInput, TOutput>,
): HookHandlerDefinition | undefined {
  return container.resolve(ContainerRegistrationKeys.HOOK_HANDLERS).get(hook.name)
}

/** The registry keys handlers by the hook's name, so a handler found under it was defined for this hook. */
function runHandler<TInput, TOutput>(
  handler: HookHandlerDefinition,
  input: TInput,
  context: StepContext,
): Promise<TOutput> {
  return (handler.run as (input: TInput, context: StepContext) => Promise<TOutput>)(input, context)
}

/** The `AppError` a handler raised, when its type is one the hook declares. */
function declaredError<TInput, TOutput extends HookValue>(hook: Hook<TInput, TOutput>, error: unknown) {
  const appError = error instanceof WorkflowTerminalError ? error.cause : error
  if (!AppError.isError(appError) || !hook.throws.includes(appError.type)) return undefined
  return appError
}

function unexpectedHandlerError<TInput, TOutput extends HookValue>(
  hook: Hook<TInput, TOutput>,
  handler: HookHandlerDefinition,
  error: unknown,
): AppError {
  return new AppError({
    type: ErrorTypes.UNEXPECTED_STATE,
    message: i18n.t('The handler for hook "{hook}" from extension "{extension}" failed: {reason}'),
    values: {
      hook: hook.name,
      extension: handler.extension,
      reason: error instanceof Error ? error.message : String(error),
    },
  })
}
