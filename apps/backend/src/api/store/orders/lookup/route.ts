import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { StoreLookupOrder, StoreOrderLookupResponse } from '@proteus/http-schemas/store'
import { i18n } from '@proteus/utils'

export const PostInput = { body: StoreLookupOrder }
export const PostOutput = StoreOrderLookupResponse
export const PostThrows = [ErrorTypes.NOT_FOUND] as const

// TODO(order-lookup): limit attempts per client. Four digits are 10,000 guesses for one display id,
// which this MVP accepts.
export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const orderService = req.scope.resolve(Modules.ORDER)
  const { displayId, phoneLastDigits } = req.body

  const id = await orderService.findOrderIdByDisplayIdAndPhoneDigits(displayId, phoneLastDigits)

  // One answer for an unknown number, wrong digits and an Order without a phone, so the lookup
  // cannot be used to learn which Orders exist.
  if (!id) {
    throw new AppError({ type: ErrorTypes.NOT_FOUND, message: i18n.t('No order matches that number and phone') })
  }

  return { status: 200, json: { id } }
}
