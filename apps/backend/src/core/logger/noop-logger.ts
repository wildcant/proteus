import type { Logger } from '../../core/types/logger.js'

export const noopLogger: Logger = {
  error() {},
  warn() {},
  info() {},
  http() {},
  debug() {},
  setLogLevel() {},
  shouldLog: () => false,
}
