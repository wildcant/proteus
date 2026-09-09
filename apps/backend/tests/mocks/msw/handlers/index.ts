import { resendHandlers } from './resend.mocks.js'
import { stripeHandlers } from './stripe.mocks.js'

export const handlers = [...resendHandlers, ...stripeHandlers]
