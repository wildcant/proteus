/**
 * A stand-in for Stripe.js, served in place of the real script.
 *
 * The browser half of the payment flow is not observable any other way: the shopper's card is
 * confirmed against Stripe directly, so a spec that only faked our own API would prove nothing
 * about the sequence this ticket exists to change. This fake implements enough of the object
 * `@stripe/react-stripe-js` drives — `elements()`, an element that mounts, `submit()`,
 * `confirmPayment()`, `retrievePaymentIntent()` — to run the real adapter unmodified.
 *
 * Two things it deliberately does *not* fake:
 *
 * - **The intent.** It reads and advances the same intent the backend created, through the fake
 *   gateway's control server, so "the browser confirmed it" and "the server authorized it" are
 *   the same fact rather than two agreeing fictions.
 * - **The amount check.** Stripe.js refuses a confirmation whose Elements amount disagrees with
 *   the intent's, and so does this. That is what makes the cart-changed-late spec able to fail.
 *
 * Accepted fidelity gaps, so nobody reads more into a passing spec than it says: the card fields
 * are plain inputs in a same-origin iframe rather than Stripe's cross-origin one (the frame
 * boundary is modelled, the origin is not), and the 3D Secure challenge is rendered in the top
 * document rather than an overlay frame.
 */

/**
 * Card numbers the fake recognises, mirroring Stripe's published test cards.
 *
 * `settlesLater` is the exception and is deliberately not one of them: Stripe publishes no card
 * that lands an intent in `processing`, because the methods that reliably reach it are not cards
 * at all. It is spelled as an obvious derivative of `succeeds` so nobody mistakes it for a
 * documented number, and it exists because `processing` is a state the backend has to answer for
 * whatever produced it.
 */
export const FAKE_CARDS = {
  succeeds: '4242424242424242',
  declinedGeneric: '4000000000000002',
  declinedLostCard: '4000000000009987',
  requiresAuthentication: '4000002760003184',
  settlesLater: '4242424242420077',
} as const

/** The control server `apps/backend/tests/mocks/fake-gateway-server.ts` listens on. */
export const FAKE_GATEWAY_URL = 'http://localhost:3012'

export const FAKE_STRIPE_JS = String.raw`
(function () {
  var GATEWAY = '${FAKE_GATEWAY_URL}'
  var CARDS = ${JSON.stringify(FAKE_CARDS)}

  // Everything the fake was asked to do, for a spec that wants to assert on the browser half.
  window.__fakeStripe = { calls: [] }
  function record(method, params) { window.__fakeStripe.calls.push({ method: method, params: params }) }

  function intentIdOf(clientSecret) { return String(clientSecret).split('_secret')[0] }

  function loadIntent(clientSecret) {
    return fetch(GATEWAY + '/intents/' + intentIdOf(clientSecret)).then(function (response) {
      if (!response.ok) return null
      return response.json()
    })
  }

  function advanceIntent(clientSecret, status, lastPaymentError, card) {
    return fetch(GATEWAY + '/intents/' + intentIdOf(clientSecret) + '/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: status, lastPaymentError: lastPaymentError || null, card: card || null }),
    }).then(function (response) { return response.json() })
  }

  /**
   * The card, as the gateway would hold it after a confirmation.
   *
   * The network comes off the first digit, which is how a real issuer identifier range works at
   * the resolution these specs need: a spec asserting a saved Visa should type a Visa.
   */
  function cardOf(values) {
    var number = String(values.number || '')
    var first = number.charAt(0)
    var brand = first === '4' ? 'visa' : first === '5' ? 'mastercard' : first === '3' ? 'amex' : 'unknown'
    var expiry = String(values.expiry || '12 / 34').split('/')
    return {
      brand: brand,
      last4: number.slice(-4),
      expMonth: Number(String(expiry[0]).trim()) || 12,
      expYear: 2000 + (Number(String(expiry[1]).trim()) || 34),
    }
  }

  var FRAME_STYLES =
    'body{margin:0;font:14px system-ui,sans-serif;color:#0d1012;background:transparent}' +
    'label{display:block;margin:0 0 12px}' +
    'span{display:block;font-size:12px;color:#767a7f;margin-bottom:4px}' +
    'input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #dee0e3;font:inherit}' +
    'fieldset{border:1px solid #dee0e3;margin:0 0 12px;padding:8px}' +
    'legend{font-size:12px;color:#767a7f}'

  var FRAME_BODY =
    '<fieldset><legend>Payment method</legend>' +
    '<label><input type="radio" name="method" value="card" checked> Card</label>' +
    '<label><input type="radio" name="method" value="redirect"> Test redirect method</label>' +
    '<label><input type="radio" name="method" value="redirect-declined"> Test redirect method (declined)</label>' +
    '</fieldset>' +
    '<label><span>Card number</span><input id="number" autocomplete="cc-number" inputmode="numeric"></label>' +
    '<label><span>Expiration</span><input id="expiry" autocomplete="cc-exp" value="12 / 34"></label>' +
    '<label><span>CVC</span><input id="cvc" autocomplete="cc-csc" value="123"></label>'

  function declineError(declineCode, message) {
    return {
      type: 'card_error',
      code: 'card_declined',
      decline_code: declineCode,
      message: message,
      request_log_url: 'https://dashboard.stripe.com/test/logs/req_fake_' + declineCode,
    }
  }

  /** One mounted element. The frame is same-origin so the fake can read what was typed. */
  function FakeElement(group, type) {
    this.group = group
    this.type = type
    this.frame = null
    this.handlers = {}
  }

  FakeElement.prototype.mount = function (target) {
    var node = typeof target === 'string' ? document.querySelector(target) : target
    var frame = document.createElement('iframe')
    // Stripe's own title, so a spec's frame locator reads the way it would against the real thing.
    frame.title = 'Secure payment input frame'
    frame.setAttribute('data-testid', 'fake-stripe-frame')
    frame.style.cssText = 'width:100%;height:260px;border:0;display:block'
    node.appendChild(frame)

    var write = function () {
      var doc = frame.contentDocument
      if (!doc) return
      doc.open()
      doc.write('<!doctype html><html><head><style>' + FRAME_STYLES + '</style></head><body>' + FRAME_BODY + '</body></html>')
      doc.close()
    }
    write()
    frame.addEventListener('load', write)

    this.frame = frame
    var self = this
    // Stripe emits 'ready' asynchronously; react-stripe-js subscribes before the frame settles.
    setTimeout(function () { self.emit('ready', { elementType: self.type }) }, 0)
    return this
  }

  FakeElement.prototype.values = function () {
    var doc = this.frame && this.frame.contentDocument
    if (!doc) return { method: 'card', number: '' }
    var checked = doc.querySelector('input[name="method"]:checked')
    var number = doc.getElementById('number')
    var expiry = doc.getElementById('expiry')
    return {
      method: checked ? checked.value : 'card',
      number: number ? String(number.value).replace(/\s+/g, '') : '',
      expiry: expiry ? String(expiry.value) : '',
    }
  }

  FakeElement.prototype.on = function (event, handler) { (this.handlers[event] = this.handlers[event] || []).push(handler); return this }
  FakeElement.prototype.off = function (event, handler) {
    var list = this.handlers[event] || []
    this.handlers[event] = list.filter(function (candidate) { return candidate !== handler })
    return this
  }
  FakeElement.prototype.emit = function (event, payload) {
    ;(this.handlers[event] || []).forEach(function (handler) { handler(payload) })
  }
  FakeElement.prototype.update = function () { return this }
  FakeElement.prototype.focus = function () { return this }
  FakeElement.prototype.blur = function () { return this }
  FakeElement.prototype.clear = function () { return this }
  FakeElement.prototype.unmount = function () { if (this.frame) this.frame.remove(); return this }
  FakeElement.prototype.destroy = function () { return this.unmount() }

  function FakeElements(options) {
    this.options = Object.assign({}, options)
    this.elements = {}
  }

  FakeElements.prototype.create = function (type, options) {
    record('elements.create', { type: type, options: options })
    var element = new FakeElement(this, type)
    this.elements[type] = element
    return element
  }
  FakeElements.prototype.getElement = function (type) { return this.elements[type] || null }
  FakeElements.prototype.update = function (updates) {
    record('elements.update', updates)
    this.options = Object.assign({}, this.options, updates)
    return Promise.resolve()
  }
  FakeElements.prototype.fetchUpdates = function () { return Promise.resolve({}) }

  /**
   * Local validation, and the reason nothing reaches our server when a card is mistyped.
   * A redirect method collects no card, exactly as it does not at the real gateway.
   */
  FakeElements.prototype.submit = function () {
    record('elements.submit', {})
    var payment = this.elements.payment
    var values = payment ? payment.values() : { method: 'card', number: '' }
    if (values.method !== 'card') return Promise.resolve({ selectedPaymentMethod: values.method })

    if (values.number.length < 16) {
      return Promise.resolve({
        error: { type: 'validation_error', code: 'incomplete_number', message: 'Your card number is incomplete.' },
      })
    }
    return Promise.resolve({ selectedPaymentMethod: 'card' })
  }

  /** The challenge, in the top document. Resolves to whichever button the shopper presses. */
  function runAuthenticationChallenge() {
    return new Promise(function (resolve) {
      var overlay = document.createElement('div')
      overlay.setAttribute('data-testid', 'fake-stripe-3ds')
      overlay.style.cssText =
        'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
        'background:rgba(0,0,0,.5);z-index:9999'
      overlay.innerHTML =
        '<div style="background:#fff;padding:24px;max-width:360px;text-align:center">' +
        '<h2 style="margin:0 0 8px;font:600 16px system-ui">Your bank needs to check it is you</h2>' +
        '<button type="button" id="pass">Complete authentication</button> ' +
        '<button type="button" id="fail">Fail authentication</button></div>'
      document.body.appendChild(overlay)

      var finish = function (passed) { overlay.remove(); resolve(passed) }
      overlay.querySelector('#pass').addEventListener('click', function () { finish(true) })
      overlay.querySelector('#fail').addEventListener('click', function () { finish(false) })
    })
  }

  function FakeStripe(publishableKey) { this.publishableKey = publishableKey }

  FakeStripe.prototype.elements = function (options) {
    record('stripe.elements', options)
    return new FakeElements(options)
  }

  // Present only so @stripe/react-stripe-js recognises this as a Stripe object.
  FakeStripe.prototype.createToken = function () { return Promise.resolve({}) }
  FakeStripe.prototype.createPaymentMethod = function () { return Promise.resolve({}) }
  FakeStripe.prototype.confirmCardPayment = function () { return Promise.resolve({}) }
  FakeStripe.prototype._registerWrapper = function () {}
  FakeStripe.prototype.registerAppInfo = function () {}

  FakeStripe.prototype.retrievePaymentIntent = function (clientSecret) {
    record('stripe.retrievePaymentIntent', { clientSecret: clientSecret })
    return loadIntent(clientSecret).then(function (intent) {
      if (!intent) {
        return { error: { type: 'invalid_request_error', code: 'resource_missing', message: 'No such PaymentIntent' } }
      }
      return { paymentIntent: intent }
    })
  }

  FakeStripe.prototype.confirmPayment = function (args) {
    var elements = args.elements
    var clientSecret = args.clientSecret
    record('stripe.confirmPayment', {
      clientSecret: clientSecret,
      amount: elements ? elements.options.amount : null,
      confirmParams: args.confirmParams,
    })

    return loadIntent(clientSecret).then(function (intent) {
      if (!intent) {
        return { error: { type: 'invalid_request_error', code: 'resource_missing', message: 'No such PaymentIntent' } }
      }

      /**
       * A saved card: no Elements group, because the card is already at the gateway and this is
       * the id of it. Nothing on the page collected anything, so there is nothing to validate and
       * no amount to reconcile — the real Stripe.js has nothing to compare against here either.
       */
      if (!elements) {
        var savedMethod = args.confirmParams && args.confirmParams.payment_method
        if (!savedMethod) {
          return { error: { type: 'invalid_request_error', message: 'No payment method was named' } }
        }
        if (intent.payment_method && intent.payment_method !== savedMethod) {
          return {
            error: {
              type: 'invalid_request_error',
              code: 'payment_method_mismatch',
              message: 'The PaymentIntent was created against a different payment method.',
            },
          }
        }
        return advanceIntent(clientSecret, 'requires_capture').then(function (updated) {
          return { paymentIntent: updated }
        })
      }

      // The real Stripe.js refuses this too. Without it, an Elements group left at the total the
      // page mounted with would confirm an intent priced at something else and nobody would know.
      if (intent.amount !== elements.options.amount) {
        return {
          error: {
            type: 'invalid_request_error',
            code: 'amount_mismatch',
            message:
              'The amount provided to Elements (' + elements.options.amount + ') does not match the ' +
              "PaymentIntent's amount (" + intent.amount + ').',
          },
        }
      }

      var payment = elements.getElement('payment')
      var values = payment ? payment.values() : { method: 'card', number: '' }

      if (values.method === 'redirect' || values.method === 'redirect-declined') {
        // The leg that has no local card to reach it: the shopper is declined *at the redirect
        // provider*, so nothing comes back as an error — the intent itself carries the reason and
        // the return route has to read it off the intent.
        var declined = values.method === 'redirect-declined'
        var status = declined ? 'requires_payment_method' : 'requires_capture'
        var lastPaymentError = declined ? declineError('lost_card', 'Your card has been reported lost.') : null

        return advanceIntent(clientSecret, status, lastPaymentError).then(function () {
          var url = new URL(args.confirmParams.return_url)
          url.searchParams.set('payment_intent', intent.id)
          url.searchParams.set('payment_intent_client_secret', clientSecret)
          url.searchParams.set('redirect_status', declined ? 'failed' : 'succeeded')
          window.location.assign(url.toString())
          // The tab is leaving; the adapter must never see this settle.
          return new Promise(function () {})
        })
      }

      if (values.number === CARDS.declinedGeneric) {
        return { error: declineError('generic_decline', 'Your card was declined.') }
      }
      if (values.number === CARDS.declinedLostCard) {
        return { error: declineError('lost_card', 'Your card has been reported lost.') }
      }

      // Confirmed, and the gateway has not finished deciding — money in flight, and the state
      // this fake exists to be able to produce. The card is attached exactly as it is on the
      // other confirmed states, because the shopper did pay with it.
      if (values.number === CARDS.settlesLater) {
        return advanceIntent(clientSecret, 'processing', null, cardOf(values)).then(function (updated) {
          return { paymentIntent: updated }
        })
      }

      if (values.number === CARDS.requiresAuthentication) {
        return runAuthenticationChallenge().then(function (passed) {
          if (!passed) {
            return {
              error: {
                type: 'invalid_request_error',
                code: 'payment_intent_authentication_failure',
                message: 'The provided PaymentMethod has failed authentication.',
                request_log_url: 'https://dashboard.stripe.com/test/logs/req_fake_3ds',
              },
            }
          }
          return advanceIntent(clientSecret, 'requires_capture', null, cardOf(values)).then(function (updated) {
            return { paymentIntent: updated }
          })
        })
      }

      return advanceIntent(clientSecret, 'requires_capture', null, cardOf(values)).then(function (updated) {
        return { paymentIntent: updated }
      })
    })
  }

  window.Stripe = function (publishableKey) { return new FakeStripe(publishableKey) }
})()
`
