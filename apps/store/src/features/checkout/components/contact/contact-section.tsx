import { Link } from '@tanstack/react-router'
import type { StoreCartDetailResponseCart } from '#/api/generated/model'
import { Button } from '#/components/button'
import type { CheckoutData } from '../../hooks/use-checkout-data'
import type { CheckoutForm } from '../../hooks/use-checkout-form'
import { CheckoutSection } from '../checkout-section'
import { CheckoutAccount } from './checkout-account'
import { ContactForm } from './contact-form'

type ContactSectionProps = Pick<CheckoutData, 'isGuestCheckout'> & {
  cart: StoreCartDetailResponseCart
  form: CheckoutForm
}
export function ContactSection(props: ContactSectionProps) {
  const { isGuestCheckout, cart, form } = props

  if (!isGuestCheckout) {
    return <CheckoutAccount email={cart.email} />
  }

  return (
    <CheckoutSection
      title="Contact"
      action={
        <Button variant="link" render={<Link to="/login" search={{ redirect: '/checkout' }} />} className="text-sm">
          Sign in
        </Button>
      }
    >
      <ContactForm form={form} />
    </CheckoutSection>
  )
}
