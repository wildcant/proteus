import { Context } from '@temporalio/activity'

/**
 * Throwaway activity proving the round-trip: the Worker resolves it by name, runs it in a normal
 * Node process, and hands the return value back to the workflow. Reading `Context.current()` is
 * what makes that claim checkable — only code executing as an Activity can.
 */
export async function ping(name: string): Promise<string> {
  const { activityType, attempt } = Context.current().info
  return `pong: ${name} (activity ${activityType}, attempt ${attempt})`
}
