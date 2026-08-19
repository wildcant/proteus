import type { StoreCartDetailResponseCart } from '#/api/generated/model'
import { Step } from '#/features/checkout/constants'
import { useCheckoutProgress } from '#/features/checkout/hooks/use-checkout-progress'
import { CheckoutStep } from './checkout-step'
import { PaymentForm } from './payment-form'
import { ReviewStep } from './review-step'
import { ShippingAddressForm } from './shipping-address-form'
import { ShippingMethodForm } from './shipping-method-form'

type CheckoutFormProps = {
  cart: StoreCartDetailResponseCart
  step: string
}

export function CheckoutForm({ cart, step }: CheckoutFormProps) {
  const { hasAddress, hasShipping, goToStep, lastShippingMethod } = useCheckoutProgress(cart)

  return (
    <div className="space-y-6">
      <CheckoutStep
        title="Shipping Address"
        stepNumber={1}
        isOpen={step === Step.ADDRESS}
        isComplete={hasAddress}
        onEdit={() => goToStep(Step.ADDRESS)}
        summary={
          cart.shippingAddress && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <p className="font-medium text-(--foreground)">Address</p>
                <p>
                  {cart.shippingAddress.firstName} {cart.shippingAddress.lastName}
                </p>
                <p>{cart.shippingAddress.address1}</p>
                <p>
                  {cart.shippingAddress.city}, {cart.shippingAddress.province} {cart.shippingAddress.postalCode}
                </p>
                <p>{cart.shippingAddress.countryCode?.toUpperCase()}</p>
              </div>
              <div>
                <p className="font-medium text-(--foreground)">Contact</p>
                <p>{cart.email}</p>
                {!!cart.shippingAddress.phone && <p>{cart.shippingAddress.phone}</p>}
              </div>
            </div>
          )
        }
      >
        <ShippingAddressForm cart={cart} onComplete={() => goToStep(Step.DELIVERY)} />
      </CheckoutStep>

      <CheckoutStep
        title="Delivery"
        stepNumber={2}
        isOpen={step === Step.DELIVERY}
        isComplete={hasShipping}
        onEdit={() => goToStep(Step.DELIVERY)}
        summary={!!lastShippingMethod && <p>{lastShippingMethod.name}</p>}
      >
        <ShippingMethodForm
          cartId={cart.id}
          currencyCode={cart.currencyCode}
          selectedMethodId={lastShippingMethod?.shippingOptionId ?? undefined}
          onComplete={() => goToStep(Step.PAYMENT)}
        />
      </CheckoutStep>

      <CheckoutStep
        title="Payment"
        stepNumber={3}
        isOpen={step === Step.PAYMENT}
        isComplete={step === Step.REVIEW}
        onEdit={() => goToStep(Step.PAYMENT)}
        summary={<p>Payment method selected</p>}
      >
        <PaymentForm cartId={cart.id} onComplete={() => goToStep(Step.REVIEW)} />
      </CheckoutStep>

      <CheckoutStep
        title="Review"
        stepNumber={4}
        isOpen={step === Step.REVIEW}
        isComplete={false}
        onEdit={() => goToStep(Step.REVIEW)}
      >
        <ReviewStep />
      </CheckoutStep>
    </div>
  )
}
