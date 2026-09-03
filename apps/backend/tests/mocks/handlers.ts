import { resendHandlers } from './resend.js'
import { stripeHandlers } from './stripe.http.js'

export const handlers = [...resendHandlers, ...stripeHandlers]
