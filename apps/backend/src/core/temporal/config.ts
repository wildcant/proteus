import { fileURLToPath } from 'node:url'

/**
 * Where Temporal loads the `payloadConverter` export from. A path rather than the instance,
 * because the same converter has to exist inside the workflow sandbox, which the SDK builds by
 * bundling this file rather than by sharing objects across the isolate boundary.
 *
 * Loaded with `require()`, which means the process needs a TypeScript-aware require hook: `tsx`
 * provides one for `npm run worker` and `npm run dev`, and the adapter tests install the same hook
 * (see `core/workflows/temporal/__tests__/temporal-test-env.ts`) because vitest leaves node_modules
 * on plain Node.
 *
 * Shared on purpose, and the reason this file did not follow the queue and driver constants into
 * `core/workflows/temporal/config.ts`: see `README.md` next door.
 */
export const PAYLOAD_CONVERTER_PATH = fileURLToPath(new URL('./payload-converter.ts', import.meta.url))
