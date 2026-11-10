import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConsoleLogger } from '../console-logger.js'

/**
 * The workerd runtime logs through `ConsoleLogger`. Drizzle reports a database failure as
 * `Failed query: …` with the Postgres error as its `cause`, so the cause is the only line that says
 * what went wrong.
 */
describe('ConsoleLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs the whole cause chain of an error, with or without a message', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const socketError = new Error('getaddrinfo ENOTFOUND db.example.supabase.co')
    const postgresError = new Error('relation "country" does not exist', { cause: socketError })
    const queryError = new Error('Failed query: select "id" from "country"', { cause: postgresError })
    const logger = new ConsoleLogger()

    logger.error(queryError)
    logger.error('Listing countries failed', queryError)

    expect(consoleError).toHaveBeenCalledTimes(2)
    for (const [line] of consoleError.mock.calls) {
      expect(line).toContain('Failed query: select "id" from "country"')
      expect(line).toContain('Caused by: Error: relation "country" does not exist')
      expect(line).toContain('Caused by: Error: getaddrinfo ENOTFOUND db.example.supabase.co')
    }
    expect(consoleError.mock.calls[1]?.[0]).toMatch(/^Listing countries failed: /)
  })
})
