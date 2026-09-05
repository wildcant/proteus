import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { PAYMENT_METHOD_UNAVAILABLE } from '@core/errors/payment-method-code.js'
import type { AccountHolderDTO, IPaymentModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { CreatePaymentSession, IdParams, StoreCreatePaymentSessionResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '../../../../../server/ports.js'
import { ensureAccountHolders, requestingCustomer } from '../../../payment-methods/wallet.js'

export const PostInput = { params: IdParams, body: CreatePaymentSession }
export const PostOutput = StoreCreatePaymentSessionResponse

/**
 * What the shopper said about their wallet, read from the adapter's own `data` blob.
 *
 * Two values, both the shopper's to give: whether to keep the card, and which stored card they
 * picked. Neither is trusted further than its shape — the account holder they act against is
 * resolved from the session's own authentication below, never from anything on the wire.
 */
function walletChoiceOf(data: Record<string, unknown> | undefined) {
  const chosenMethodId = data?.paymentMethodId
  return {
    savePaymentMethod: data?.savePaymentMethod === true,
    paymentMethodId: typeof chosenMethodId === 'string' && chosenMethodId !== '' ? chosenMethodId : undefined,
  }
}

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
export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const paymentService = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT)
  const collection = await paymentService.retrievePaymentCollection(req.params.id)

  const wallet = walletChoiceOf(req.body.data)
  const accountHolder = await accountHolderFor(req, req.body.providerId)

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
      code: PAYMENT_METHOD_UNAVAILABLE,
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

/**
 * The account holder this checkout pays against, or nothing.
 *
 * Nothing is the guest's answer, and it is reached two ways: no session at all, and a session
 * belonging to a Customer row with `hasAccount: false` — which is every guest checkout Proteus
 * has ever written. Neither creates anything at the gateway.
 */
async function accountHolderFor(req: HttpRequest, providerId: string): Promise<AccountHolderDTO | undefined> {
  if (!req.authContext?.actorId) return undefined

  const customer = await requestingCustomer(req)
  const holders = await ensureAccountHolders(req, customer)

  return holders.find((holder) => holder.providerId === providerId)
}
