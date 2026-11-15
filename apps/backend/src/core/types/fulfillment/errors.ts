import type { Msgid } from '@proteus/utils'
import { AppError, ErrorTypes } from '../../errors/app-error.js'

/**
 * The authored `code` values a fulfillment failure answers with, where [ErrorTypes] alone is too
 * coarse to act on. Owned by the fulfillment port, as `PaymentErrorCodes` is by the payment one.
 */
export enum FulfillmentErrorCodes {
  /**
   * A provider cannot price this option for this address or these items — a city its rate table
   * does not list, a parcel over its limit. Not a failure of the request: the option is left out of
   * the listing, and setting it as a shipping method is refused.
   */
  CANNOT_CALCULATE = 'fulfillment_cannot_calculate',
  /** The option does not serve the address, is disabled, or could not be priced for it. */
  OPTION_UNAVAILABLE = 'fulfillment_option_unavailable',
}

/**
 * The error a provider's `calculatePrice` throws when it cannot price the context. The fulfillment
 * module recognises it by its code and drops the option; any other error still fails the call.
 */
export function cannotCalculateShippingPrice(message: Msgid, values?: Record<string, unknown>): AppError {
  return new AppError({
    type: ErrorTypes.NOT_ALLOWED,
    code: FulfillmentErrorCodes.CANNOT_CALCULATE,
    message,
    ...(values ? { values } : {}),
  })
}

export function isCannotCalculateShippingPrice(error: unknown): boolean {
  return AppError.isError(error) && error.code === FulfillmentErrorCodes.CANNOT_CALCULATE
}
