import type { StoreCartDetailResponseCart } from '#/api/generated/model'
import { Step } from '#/features/checkout/constants'
import { useCheckoutProgress } from '#/features/checkout/hooks/use-checkout-progress'
import { AddressSummary } from './address-summary'
import { CheckoutStep } from './checkout-step'
import { ContactForm } from './contact-form'
import { PaymentForm } from './payment-form'
import { ReviewStep } from './review-step'
import { ShippingAddressForm } from './shipping-address-form'
import { ShippingMethodForm } from './shipping-method-form'

type CheckoutFormProps = {
  cart: StoreCartDetailResponseCart
  step: string
}

export function CheckoutForm({ cart, step }: CheckoutFormProps) {
  const { isGuest, hasContact, hasAddress, hasShipping, goToStep, lastShippingMethod, stepNumber } =
    useCheckoutProgress(cart)

  return (
    <div className="space-y-6">
      {isGuest ? (
        <CheckoutStep
          title="Contact"
          stepNumber={stepNumber(Step.CONTACT)}
          isOpen={step === Step.CONTACT}
          isComplete={hasContact}
          onEdit={() => goToStep(Step.CONTACT)}
          summary={<p>{cart.email}</p>}
        >
          <ContactForm cart={cart} onComplete={() => goToStep(Step.ADDRESS)} />
        </CheckoutStep>
      ) : null}

      <CheckoutStep
        title="Shipping Address"
        stepNumber={stepNumber(Step.ADDRESS)}
        isOpen={step === Step.ADDRESS}
        isComplete={hasAddress}
        onEdit={() => goToStep(Step.ADDRESS)}
        summary={<AddressSummary cart={cart} />}
      >
        <ShippingAddressForm cart={cart} onComplete={() => goToStep(Step.DELIVERY)} />
      </CheckoutStep>

      <CheckoutStep
        title="Delivery"
        stepNumber={stepNumber(Step.DELIVERY)}
        isOpen={step === Step.DELIVERY}
        isComplete={hasShipping}
        onEdit={() => goToStep(Step.DELIVERY)}
        summary={lastShippingMethod && <p>{lastShippingMethod.name}</p>}
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
        stepNumber={stepNumber(Step.PAYMENT)}
        isOpen={step === Step.PAYMENT}
        isComplete={step === Step.REVIEW}
        onEdit={() => goToStep(Step.PAYMENT)}
        summary={<p>Payment method selected</p>}
      >
        <PaymentForm cartId={cart.id} onComplete={() => goToStep(Step.REVIEW)} />
      </CheckoutStep>

      <CheckoutStep
        title="Review"
        stepNumber={stepNumber(Step.REVIEW)}
        isOpen={step === Step.REVIEW}
        isComplete={false}
        onEdit={() => goToStep(Step.REVIEW)}
      >
        <ReviewStep />
      </CheckoutStep>
    </div>
  )
}
