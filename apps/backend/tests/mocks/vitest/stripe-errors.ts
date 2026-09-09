import Stripe from 'stripe'

/**
 * The refusals Stripe gives, as the real error classes.
 *
 * Built from `Stripe.errors` rather than from plain objects because the adapter classifies on the
 * class and the fields, and a stand-in that merely looked similar would let a broken classifier
 * pass. In a suite that registers `stripeTest.moduleMock()`, this import resolves to the mocked
 * module — whose `errors` is the real `Stripe.errors`, re-exported untouched — so nothing has to
 * capture or store them.
 *
 * Shared because four suites had written their own `connectionError` and they have to agree: the
 * whole point of a retry test is that the error it arranges is the one production would see.
 */
export const stripeErrors = {
  /** The gateway dropped the connection. Whether it got the request is unknowable, which is the point. */
  connection: () => new Stripe.errors.StripeConnectionError({ message: 'socket hang up' }),

  /** The gateway itself broke. Distinct from a dropped connection: the request certainly arrived. */
  apiError: () => new Stripe.errors.StripeAPIError({ type: 'api_error', message: 'Something went wrong' }),

  invalidApiKey: () =>
    new Stripe.errors.StripeAuthenticationError({
      type: 'authentication_error',
      message: 'Invalid API Key provided: sk_test_*****dkey',
    }),

  /**
   * A payment method id that names nothing at all.
   *
   * Carries the request id and dashboard link, because the failure-logging test asserts the
   * adapter forwards every one of them — a refusal a developer cannot look up is half a report.
   */
  missingPaymentMethod: () =>
    new Stripe.errors.StripeInvalidRequestError({
      type: 'invalid_request_error',
      code: 'resource_missing',
      param: 'payment_method',
      message: "No such PaymentMethod: 'pm_1JVFmtGCSCcgOfxvXsBg1Ldu'",
      // biome-ignore lint/style/useNamingConvention: the raw Stripe field name
      request_log_url: 'https://dashboard.stripe.com/test/logs/req_missing',
      requestId: 'req_missing',
    }),

  /**
   * A method that exists and is somebody else's: a bare 404, with no code and no param, because
   * Stripe will not confirm that another customer's method is real.
   */
  notYourPaymentMethod: () =>
    new Stripe.errors.StripeInvalidRequestError({
      type: 'invalid_request_error',
      statusCode: 404,
      message: 'No such payment_method',
      // biome-ignore lint/style/useNamingConvention: the raw Stripe field name
      request_log_url: 'https://dashboard.stripe.com/test/logs/req_foreign',
    }),

  /**
   * A write against an intent whose state cannot take it. One code covers every such state, which
   * is why the adapter has to ask what the state actually is rather than trust the code.
   */
  unexpectedState: (message: string) =>
    new Stripe.errors.StripeInvalidRequestError({
      type: 'invalid_request_error',
      code: 'payment_intent_unexpected_state',
      message,
    }),
}
