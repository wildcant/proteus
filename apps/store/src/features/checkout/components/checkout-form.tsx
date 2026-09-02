import type { StoreCartDetailResponseCart } from '#/api/generated/model'
import { Form } from '#/components/form/form'
import { useCheckoutData } from '#/features/checkout/hooks/use-checkout-data'
import { useCheckoutForm } from '../hooks/use-checkout-form'
import { PaymentControllerProvider } from '../payment/payment-controller'
import { ContactSection } from './contact/contact-section'
import { DeliverySection } from './delivery/delivery-section'
import { PaymentSection } from './payment/payment-section'
import { ShippingMethodSection } from './shipping/shipping-method-section'

type CheckoutFormProps = {
  cart: StoreCartDetailResponseCart
}

export function CheckoutForm({ cart }: CheckoutFormProps) {
  const data = useCheckoutData({ cart })
  const { form, isLoading, placeOrder, signOut, controller, paymentError } = useCheckoutForm({ data })

  return (
    // The provider spans the button as well as the payment step: the adapter registers its
    // confirm from inside its own SDK context, and the button reads it from outside.
    <PaymentControllerProvider value={controller}>
      <Form onSubmit={placeOrder}>
        <form.AppForm>
          <div className="space-y-8">
            <ContactSection form={form} onSignOut={signOut} {...data} />
            <DeliverySection form={form} {...data} />
            <ShippingMethodSection form={form} {...data} />
            <PaymentSection form={form} {...data} />

            {/* Beneath the button, not under a field: a decline is not something the shopper
                mistyped, and the press that produced it is what they are looking at. */}
            {!!paymentError && (
              <p role="alert" className="m-0 border border-sale bg-surface-subtle p-3 text-ink text-sm">
                {paymentError}
              </p>
            )}

            <form.SubmitButton className="w-full">{isLoading ? 'Placing order...' : 'Place order'}</form.SubmitButton>
          </div>
        </form.AppForm>
      </Form>
    </PaymentControllerProvider>
  )
}
