export const Step = {
  ADDRESS: 'address',
  DELIVERY: 'delivery',
  PAYMENT: 'payment',
  REVIEW: 'review',
} as const
export type Step = (typeof Step)[keyof typeof Step]
export const STEPS = [Step.ADDRESS, Step.DELIVERY, Step.PAYMENT, Step.REVIEW] as const
export const LAST_STEP = Step.REVIEW
