import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IPaymentModuleService } from '@core/types/index.js'
import { PaymentErrorCodes } from '@core/types/payment/errors.js'
import { Modules } from '@core/utils/index.js'
import { CreatePaymentSession, IdParams, StoreCreatePaymentSessionResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { readWalletChoice } from '@workflows/payment/utils/read-wallet-choice.js'
import { attachCustomer } from '../../../middlewares.js'

export const PostInput = { params: IdParams, body: CreatePaymentSession }
export const PostMiddlewares = [attachCustomer()] as const
export const PostOutput = StoreCreatePaymentSessionResponse
type PostRequest = HttpRequest<typeof PostInput, typeof PostMiddlewares>

/**
 * Opens the session for a checkout.
 *
 * `replacePaymentSession`, not `createPaymentSession`: every Place order press comes through
 * here, so a shopper who is declined and reaches for a second card is retrying rather than paying
 * twice. The previous attempt is abandoned and cancelled at the gateway before this one opens.
 * The admin's mark-as-paid route keeps the additive operation — its session is not a retry of
 * anything.
 *
 * The account holder is attached here rather than sent by the browser, and the browser's own
 * `context` is discarded. Both matter: a client that could name an account holder could charge a
 * stranger's saved card, and a session's context is stored and served back, so only an id and the
 * gateway's own reference go into it.
 */
export const POST = async (req: PostRequest): Promise<HttpResult<typeof PostOutput>> => {
  const paymentService = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const collection = await paymentService.retrievePaymentCollection(req.params.id)
  const wallet = readWalletChoice(req.body.data)

  // The account holder this checkout pays against, or nothing.
  //
  // Nothing is the guest's answer, and it is reached two ways: no session at all, and a session
  // belonging to a Customer row with `hasAccount: false` — which is every guest checkout Proteus
  // has ever written. Neither creates anything at the gateway, which is why the gate is the account
  // rather than the row `attachCustomer()` found.
  const customer = req.customer
  const accountHolders = customer?.hasAccount
    ? await paymentService.ensureAccountHolders({
        customerId: customer.id,
        email: customer.email,
        name: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || null,
      })
    : []
  const accountHolder = accountHolders.find((holder) => holder.providerId === req.body.providerId)

  // A named saved card with no account holder to check it against, answered the way the wallet
  // answers every other card it cannot act on.
  //
  // The reachable path is not a broken client: a shopper whose session expires between the
  // selector rendering and Place order being pressed arrives here unauthenticated, still naming
  // the card they picked. That id is stale in exactly the sense the wallet means, and it is the
  // 409 the storefront listens for to refetch and reset the selection. Left to fall through, the
  // adapter refuses it as a programming error and the shopper reads the words "the Stripe
  // adapter" in a 400.
  if (wallet.paymentMethodId && !accountHolder) {
    throw new AppError({
      type: ErrorTypes.CONFLICT,
      code: PaymentErrorCodes.METHOD_UNAVAILABLE,
      message: 'That payment method is no longer available.',
    })
  }

  const session = await paymentService.replacePaymentSession(collection.id, {
    providerId: req.body.providerId,
    amount: collection.amount,
    currencyCode: collection.currencyCode,
    data: req.body.data,
    context: {
      ...(accountHolder ? { accountHolder: { id: accountHolder.id, externalId: accountHolder.externalId } } : {}),
      // Consent is recorded even without an account holder, so the session says what the shopper
      // asked for rather than what the gateway happened to be able to do about it.
      savePaymentMethod: wallet.savePaymentMethod,
      ...(wallet.paymentMethodId ? { paymentMethodId: wallet.paymentMethodId } : {}),
    },
  })

  return { status: 201, json: { paymentSession: session } }
}
