import { env } from '@env'
import type { Logger } from '../../core/types/logger.js'

const LOG_LEVELS: Record<string, number> = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

export class ConsoleLogger implements Logger {
  #level: string = env.LOG_LEVEL

  error(messageOrError: string | Error, error?: Error): void {
    if (typeof messageOrError === 'object' && messageOrError instanceof Error) {
      console.error(messageOrError)
    } else if (error) {
      console.error(messageOrError, error)
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
