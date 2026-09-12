import { fileURLToPath } from 'node:url'

/**
 * The queue everything uses unless told otherwise, and the default behind `env.TEMPORAL_TASK_QUEUE`
 * — which is what actually routes. Read this constant only where there is no environment to read:
 * the server tests build a Worker and a client in one process and just need the two to agree.
 *
 * The literal is repeated in `env.ts` rather than imported from here: `index.workerd.ts` reaches
 * that file, and `no-temporal-in-workerd` stops it reaching this one.
 */
export const DEFAULT_TEMPORAL_TASK_QUEUE = 'proteus'

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
 * The registered name of the generic driver workflow. Referenced as a string rather than as the
 * imported function, so the API process never loads `workflows.ts` — that module pulls in
 * `@temporalio/workflow`, whose runtime only makes sense inside the sandbox.
 */
export const PROTEUS_WORKFLOW_TYPE = 'proteusWorkflow'
