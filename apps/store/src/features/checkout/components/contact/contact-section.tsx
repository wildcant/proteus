import { Trans, useLingui } from '@lingui/react/macro'
import type { StoreCartDetailResponseCart } from '#/api/generated/model'
import { ButtonLink } from '#/components/button'
import type { CheckoutData } from '../../hooks/use-checkout-data'
import type { CheckoutForm } from '../../hooks/use-checkout-form'
import { CheckoutSection } from '../checkout-section'
import { CheckoutAccount } from './checkout-account'
import { ContactForm } from './contact-form'

type ContactSectionProps = Pick<CheckoutData, 'isGuestCheckout'> & {
  cart: StoreCartDetailResponseCart
  form: CheckoutForm
  onSignOut: () => void
}
export function ContactSection(props: ContactSectionProps) {
  const { isGuestCheckout, cart, form, onSignOut } = props
  const { t } = useLingui()

  if (!isGuestCheckout) {
    return <CheckoutAccount email={cart.email} onSignOut={onSignOut} />
  }

  return (
    <CheckoutSection
      title={t`Contact`}
      action={
        <ButtonLink variant="link" to="/login" search={{ redirect: '/checkout' }} className="text-sm">
          <Trans>Sign in</Trans>
        </ButtonLink>
      }
    >
      <ContactForm form={form} />
    </CheckoutSection>
  )
}
