import type { Msgid } from '@proteus/utils'
import { fillValues } from '../i18n/fill-values.js'

export enum ErrorTypes {
  NOT_FOUND = 'not_found',
  INVALID_DATA = 'invalid_data',
  NOT_ALLOWED = 'not_allowed',
  UNAUTHORIZED = 'unauthorized',
  FORBIDDEN = 'forbidden',
  CONFLICT = 'conflict',
  DUPLICATE_ERROR = 'duplicate_error',
  DB_ERROR = 'db_error',
  UNEXPECTED_STATE = 'unexpected_state',
  INVALID_ARGUMENT = 'invalid_argument',
  /** A dependency we do not own is down or throttling us. The caller may retry; nothing is wrong
   *  with the request itself, which is what separates this from every other type here. */
  SERVICE_UNAVAILABLE = 'service_unavailable',
}

export class AppError extends Error {
  __isAppError = true
  type: ErrorTypes
  /**
   * The specific reason, where the type alone is too coarse for a client to act on —
   * `payment_method_unavailable` against a `conflict`, say. It reaches the response body, so it is
   * an authored constant from the owning domain's code enum — see [PaymentErrorCodes] — and never
   * a third party's string. Typed `string` because each domain names its own; there is no union
   * here to widen every time one does.
   */
  code?: string | undefined
  /**
   * The message as the catalog knows it, placeholders unfilled — what the response translates.
   * `Error.message` is the same sentence in English with `values` filled in, so logs, Temporal
   * workers and tests keep reading English.
   */
  msgid: Msgid
  /** Fills the message's `{name}` placeholders, in English here and in the response's language. */
  values?: Record<string, unknown> | undefined
  date: Date

  constructor(opts: { type: ErrorTypes; message: string; code?: string; values?: Record<string, unknown> }) {
    super(fillValues(opts.message, opts.values))
    this.type = opts.type
    this.code = opts.code
    // Cast until ILLO-204 flips `message` to `Msgid`; a message not in a catalog translates to itself.
    this.msgid = opts.message as Msgid
    this.values = opts.values
    this.date = new Date()
  }

  static Types = ErrorTypes

  static isError(err: unknown): err is AppError {
    return typeof err === 'object' && err !== null && '__isAppError' in err && (err as AppError).__isAppError === true
  }
}
