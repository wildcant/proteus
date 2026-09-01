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
