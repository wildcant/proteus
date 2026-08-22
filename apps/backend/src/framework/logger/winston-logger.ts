import { inspect } from 'node:util'
import winston from 'winston'
import type { Logger } from '../../core/types/logger.js'
import { env } from '../../env.js'

// Anything that is not a real deployment gets the human-readable CLI format,
// including the NODE_ENV=test e2e server.
const IS_DEV = env.NODE_ENV !== 'production'
function buildTransports(): winston.transport[] {
  const transports: winston.transport[] = []

  if (IS_DEV) {
    const message = Symbol.for('message')
    const appendStack = winston.format((info) => {
      if (info.stack) {
        ;(info as Record<string | symbol, unknown>)[message] += `\n${info.stack}`
      }
      return info
    })

    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.cli({ levels: winston.config.npm.levels }),
          winston.format.splat(),
          appendStack(),
        ),
      }),
    )
  } else {
    transports.push(new winston.transports.Console())
  }

  if (env.LOG_FILE) {
    transports.push(new winston.transports.File({ filename: env.LOG_FILE }))
  }

  return transports
}

export class WinstonLogger implements Logger {
  private logger: winston.Logger

  constructor() {
    this.logger = winston.createLogger({
      level: env.LOG_LEVEL,
      levels: winston.config.npm.levels,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(),
      ),
      transports: buildTransports(),
    })
  }

  error(messageOrError: string | Error, error?: Error): void {
    let message: string
    let errorObj: Error | undefined

    if (typeof messageOrError === 'object' && messageOrError instanceof Error) {
      message = messageOrError.message
      errorObj = messageOrError
    } else {
      message = messageOrError
      errorObj = error
    }

    const entry: Record<string, unknown> = { level: 'error', message }

    if (errorObj) {
      if (message !== errorObj.message) {
        entry.message = `${message}: ${errorObj.message}`
      }
      entry.stack = errorObj.stack
      const cause = (errorObj as Error & { cause?: unknown })?.cause
      if (cause) {
        entry.cause = inspect(cause)
      }
    }

    this.logger.log(entry as winston.LogEntry)
  }

  warn(message: string): void {
    this.logger.warn(message)
  }

  info(message: string): void {
    this.logger.info(message)
  }

  http(message: string): void {
    this.logger.http(message)
  }

  debug(message: string): void {
    this.logger.debug(message)
  }

  setLogLevel(level: string): void {
    this.logger.level = level
  }

  shouldLog(level: string): boolean {
    const levelValue = this.logger.levels[level]
    const currentLevel = this.logger.levels[this.logger.level]
    if (levelValue === undefined || currentLevel === undefined) return false
    return levelValue <= currentLevel
  }
}
