import type { StoreCartDetailResponseCart } from '#/api/generated/model'
import { Form } from '#/components/form/form'
import { useCheckoutData } from '#/features/checkout/hooks/use-checkout-data'
import { useCheckoutForm } from '../hooks/use-checkout-form'
import { ContactSection } from './contact/contact-section'
import { DeliverySection } from './delivery/delivery-section'
import { PaymentSection } from './payment/payment-section'
import { ShippingMethodSection } from './shipping/shipping-method-section'

type CheckoutFormProps = {
  cart: StoreCartDetailResponseCart
}

export function CheckoutForm({ cart }: CheckoutFormProps) {
  const data = useCheckoutData({ cart })
  const { form, isLoading, placeOrder, signOut, hasFailedOrder } = useCheckoutForm({ data })

  return (
    <Form onSubmit={placeOrder}>
      <form.AppForm>
        <div className="space-y-8">
          <ContactSection form={form} onSignOut={signOut} {...data} />
          <DeliverySection form={form} {...data} />
          <ShippingMethodSection form={form} {...data} />
          <PaymentSection form={form} hasFailedOrder={hasFailedOrder} onReopened={placeOrder} {...data} />

          <form.SubmitButton className="w-full">{isLoading ? 'Placing order...' : 'Place order'}</form.SubmitButton>
        </div>
      </form.AppForm>
    </Form>
  )
}
