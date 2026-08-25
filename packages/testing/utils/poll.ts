import { expect } from '@playwright/test'

/** A backend round trip, plus the cold compile the first run after globalSetup pays for. */
export const BACKEND_TIMEOUT = 30_000

/**
 * Waits for a backend write to land, then returns it.
 *
 * The app writes rows asynchronously relative to the interaction that caused them, so
 * reading once races the request. `read` should return null while the row is missing;
 * the result comes back narrowed to non-null.
 */
export async function pollDatabase<T>(
  read: () => Promise<T | null>,
  message: string,
  timeout = BACKEND_TIMEOUT,
): Promise<T> {
  let record: T | null = null

  await expect
    .poll(
      async () => {
        record = await read()
        return record
      },
      { timeout, message },
    )
    .not.toBeNull()

  return record as unknown as T
}
