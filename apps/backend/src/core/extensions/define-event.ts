declare const eventBrand: unique symbol

/**
 * An event an extension declares, carrying its payload type and its deduplication identity.
 *
 * Core's events live in the closed `EventPayloads` map an extension may not edit, so an extension
 * event is a value instead: `bus.emit(event, data)` checks `data` against `TPayload`, and a
 * subscriber whose config names the event is handed `TPayload`.
 *
 * `key` is the resource half of the dispatch identity, the counterpart of `EVENT_KEYS` for core
 * events: the payload's `id` by default, which means *once per resource*, or a function for an event
 * that legitimately happens more than once to one resource. A method rather than a property, so an
 * event of any payload is assignable to `ExtensionEvent<unknown>` and the bus can hold them in one
 * list.
 */
export type ExtensionEvent<TPayload = unknown> = {
  readonly name: string
  key(data: TPayload): string
  readonly [eventBrand]?: 'extension-event'
}

type KeyOption<TPayload> = TPayload extends { id: string }
  ? { key?: (data: TPayload) => string }
  : { key: (data: TPayload) => string }

/**
 * Declared in the extension's `events.ts`. The name carries the extension's runtime prefix
 * (`pisos-dj.quote_requested`), which `extensions:generate` checks. A payload without an `id` must
 * say how it is keyed.
 *
 * @extensionApi The extension and hook API: no core code calls it until a fork does, so the production
 * unused-code pass skips it (`scripts/checks/unused.sh`).
 */
export function defineEvent<TPayload>(config: { name: string } & KeyOption<TPayload>): ExtensionEvent<TPayload> {
  const { name, key } = config
  return {
    name,
    key: key ?? ((data) => (data as { id: string }).id),
  }
}
