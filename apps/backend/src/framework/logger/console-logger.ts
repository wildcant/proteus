import { env } from '@env'
import type { Logger } from '../../core/types/logger.js'

const LOG_LEVELS: Record<string, number> = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

/**
 * workerd prints an Error as its stack alone and drops `cause`. Drizzle wraps every database failure
 * in `Failed query: …`, so without the chain the log never says why Postgres refused.
 */
function formatError(error: Error): string {
  let text = error.stack ?? `${error.name}: ${error.message}`
  let cause: unknown = error.cause

  while (cause !== undefined) {
    text += `\nCaused by: ${cause instanceof Error ? (cause.stack ?? `${cause.name}: ${cause.message}`) : String(cause)}`
    cause = cause instanceof Error ? cause.cause : undefined
  }

  return text
}

export class ConsoleLogger implements Logger {
  #level: string = env.LOG_LEVEL

  error(messageOrError: string | Error, error?: Error): void {
    if (typeof messageOrError === 'object' && messageOrError instanceof Error) {
      console.error(formatError(messageOrError))
    } else if (error) {
      console.error(`${messageOrError}: ${formatError(error)}`)
    } else {
      console.error(messageOrError)
    }
  }

  warn(message: string): void {
    if (this.shouldLog('warn')) console.warn(message)
  }

  info(message: string): void {
    if (this.shouldLog('info')) console.info(message)
  }

  http(message: string): void {
    if (this.shouldLog('http')) console.log(message)
  }

  debug(message: string): void {
    if (this.shouldLog('debug')) console.debug(message)
  }

  setLogLevel(level: string): void {
    this.#level = level
  }

  shouldLog(level: string): boolean {
    const levelValue = LOG_LEVELS[level]
    const currentLevel = LOG_LEVELS[this.#level]
    if (levelValue === undefined || currentLevel === undefined) return false
    return levelValue <= currentLevel
  }
}
