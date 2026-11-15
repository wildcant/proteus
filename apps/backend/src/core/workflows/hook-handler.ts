/**
 * A registered handler, as the extension registry and the container carry it: its types erased, its
 * extension named. `never` in every parameter position is what lets each `HookHandler<TInput, TOutput>`
 * from `hooks.ts` be assigned here; only `hookStep` and `runHook`, which hold the typed `Hook`, call
 * through it.
 *
 * Its own file, importing nothing, because the container's contracts name it and `hooks.ts` reads the
 * container — declaring it there would close an import cycle.
 */
export type HookHandlerDefinition = {
  /** The hook's name, `defineHook({ name })`. One handler per name. */
  hook: string
  /** The extension that registered it — the provenance a hook step records. */
  extension: string
  run: (input: never, context: never) => Promise<unknown>
  compensate?: (output: never, context: never) => Promise<void>
}

/** What the container holds under `ContainerRegistrationKeys.HOOK_HANDLERS`: handlers by hook name. */
export type HookHandlers = ReadonlyMap<string, HookHandlerDefinition>
