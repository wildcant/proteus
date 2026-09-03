import { fileURLToPath } from 'node:url'

/**
 * The single queue this stage uses. A Worker polls it and a client targets it; nothing else in the
 * codebase names a queue yet, so one constant is the whole routing story.
 */
export const TEMPORAL_TASK_QUEUE = 'proteus'

/**
 * Absolute path to the workflow module. The Worker runs workflow code in a v8 isolate it builds
 * itself, so it needs a file on disk rather than an imported binding — and the path points at the
 * `.ts` source because nothing compiles this backend ahead of time (`dev` and `start` both run
 * through tsx).
 *
 * Deliberately env-free: the test imports this module, and pulling in `env.ts` would make the
 * round-trip test depend on the full environment schema.
 */
export const WORKFLOWS_PATH = fileURLToPath(new URL('./workflows.ts', import.meta.url))

/**
 * Where Temporal loads the `payloadConverter` export from. A path rather than the instance,
 * because the same converter has to exist inside the workflow sandbox, which the SDK builds by
 * bundling this file rather than by sharing objects across the isolate boundary.
 *
 * Loaded with `require()`, which means the process needs a TypeScript-aware require hook: `tsx`
 * provides one for `npm run worker` and `npm run dev`, and the adapter tests install the same hook
 * (see `__tests__/temporal-test-env.ts`) because vitest leaves node_modules on plain Node.
 */
export const PAYLOAD_CONVERTER_PATH = fileURLToPath(new URL('./payload-converter.ts', import.meta.url))

/**
 * The registered name of the generic driver workflow. Referenced as a string rather than as the
 * imported function, so the API process never loads `workflows.ts` — that module pulls in
 * `@temporalio/workflow`, whose runtime only makes sense inside the sandbox.
 */
export const PROTEUS_WORKFLOW_TYPE = 'proteusWorkflow'
