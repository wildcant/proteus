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
  date: Date

  constructor(opts: { type: ErrorTypes; message: string; code?: string }) {
    super(opts.message)
    this.type = opts.type
    this.code = opts.code
    this.date = new Date()
  }

  static Types = ErrorTypes

  static isError(err: unknown): err is AppError {
    return typeof err === 'object' && err !== null && '__isAppError' in err && (err as AppError).__isAppError === true
  }
}
