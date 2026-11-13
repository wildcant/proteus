import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import type { StoreCartDetailResponseCart } from '#/api/generated/model'
import { Form } from '#/components/form/form'
import {
  checkoutForm,
  checkoutFormContact,
  checkoutFormContent,
  checkoutFormDelivery,
  checkoutFormLegal,
  checkoutFormPayment,
  checkoutFormPlaceOrder,
  checkoutFormShippingMethod,
} from '#/features/checkout/components/checkout-form/checkout-form.variants'
import { ContactSection } from '#/features/checkout/components/contact/contact-section'
import { DeliverySection } from '#/features/checkout/components/delivery/delivery-section'
import { PaymentSection } from '#/features/checkout/components/payment/payment-section'
import { PaymentErrorAlert } from '#/features/checkout/components/payment-error-alert/payment-error-alert'
import { ShippingMethodSection } from '#/features/checkout/components/shipping/shipping-method-section'
import { useCheckoutData } from '#/features/checkout/hooks/use-checkout-data'
import { useCheckoutForm } from '#/features/checkout/hooks/use-checkout-form'
import { PaymentControllerProvider } from '#/features/checkout/hooks/use-payment-controller'
import type { CheckoutLinks } from '#/features/checkout/types/links'

type CheckoutFormProps = {
  cart: StoreCartDetailResponseCart
  links: CheckoutLinks
  className?: string
}

export function CheckoutForm({ cart, links, className }: CheckoutFormProps) {
  const data = useCheckoutData({ cart })
  const { form, placeOrder, signOut, controller, paymentError } = useCheckoutForm({ data, links })

  return (
    // The provider spans the button as well as the payment step: the adapter registers its
    // confirm from inside its own SDK context, and the button reads it from outside.
    <PaymentControllerProvider value={controller}>
      <Form onSubmit={placeOrder} className={cn(checkoutForm(), className)}>
        <form.AppForm>
          <ContactSection
            form={form}
            onSignOut={signOut}
            signInLink={links.signIn}
            className={checkoutFormContact()}
            {...data}
          />
          {/* The section bodies' content is the caller's (`checkoutFormContent`, one per section). */}
          <DeliverySection
            form={form}
            links={links}
            className={checkoutFormDelivery()}
            contentClassName={checkoutFormContent()}
            {...data}
          />
          <ShippingMethodSection
            form={form}
            className={checkoutFormShippingMethod()}
            contentClassName={checkoutFormContent()}
            {...data}
          />
          <PaymentSection
            form={form}
            className={checkoutFormPayment()}
            contentClassName={checkoutFormContent()}
            {...data}
          />

          {/* The legal line, the error and the button sit flush, as the store renders them; the set
              draws them 32px apart like the sections. */}
          <div className="flex flex-col">
            {/* A checkout-level slot, not part of the selector: the line is not provider-specific
              and must not move when a second provider is added. Plain text rather than links,
              for the reason the footer's legal column does not exist yet — `/terms`, `/privacy`
              and `/cookies` are not routes, and a link that quietly lands on the home page is a
              bug the shopper walks into rather than a placeholder they can read. */}
            <p className={cn(checkoutFormLegal(), 'm-0')}>
              <Trans>
                By placing your order you agree to our Terms and Conditions, Privacy Notice and Cookie Policy.
              </Trans>
            </p>

            {!!paymentError && <PaymentErrorAlert message={paymentError} />}

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <form.SubmitButton className={checkoutFormPlaceOrder()}>
                  {isSubmitting ? <Trans>Placing order...</Trans> : <Trans>Place order</Trans>}
                </form.SubmitButton>
              )}
            </form.Subscribe>
          </div>
        </form.AppForm>
      </Form>
    </PaymentControllerProvider>
  )
}
