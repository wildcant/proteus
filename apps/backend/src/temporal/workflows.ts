import { proxyActivities } from '@temporalio/workflow'
import type * as activities from './activities.js'

/**
 * Workflow code is bundled into a deterministic isolate with no filesystem, no network and no
 * clock, so it may only import from `@temporalio/workflow`. The activities import is type-only and
 * erases at build time; the call below goes over the task queue, not through that binding.
 */
const { ping } = proxyActivities<typeof activities>({ startToCloseTimeout: '10 seconds' })

export async function pingWorkflow(name: string): Promise<string> {
  return await ping(name)
}
