import { useNavigate } from '@tanstack/react-router'
import type { StoreCartDetailResponseCart } from '#/api/generated/model'
import { AUTHED_STEPS, STEPS, type Step } from '#/features/checkout/constants'
import { isGuest } from '#/lib/auth-token'

export function useCheckoutProgress(cart: StoreCartDetailResponseCart) {
  const navigate = useNavigate()

  const isGuestCheckout = isGuest()
  const hasContact = !!cart.email
  const hasAddress = !!cart.shippingAddress
  const hasShipping = cart.shippingMethods.length > 0

  const goToStep = (step: Step) => {
    navigate({ to: '/checkout', search: { step }, replace: true })
  }

  const lastShippingMethod = cart.shippingMethods.at(-1)

  // Dynamic step numbers: guests see CONTACT as step 1, authenticated users start at ADDRESS
  const stepNumber = (step: Step) => {
    const order = isGuestCheckout ? STEPS : AUTHED_STEPS
    return order.indexOf(step) + 1
  }

  return {
    isGuest: isGuestCheckout,
    hasContact,
    hasAddress,
    hasShipping,
    goToStep,
    lastShippingMethod,
    stepNumber,
  }
}
