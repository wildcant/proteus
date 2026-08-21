export const Step = {
  CONTACT: 'contact',
  ADDRESS: 'address',
  DELIVERY: 'delivery',
  PAYMENT: 'payment',
  REVIEW: 'review',
} as const
export type Step = (typeof Step)[keyof typeof Step]
export const STEPS = [Step.CONTACT, Step.ADDRESS, Step.DELIVERY, Step.PAYMENT, Step.REVIEW]
export const AUTHED_STEPS = [Step.ADDRESS, Step.DELIVERY, Step.PAYMENT, Step.REVIEW]
export const LAST_STEP = Step.REVIEW
