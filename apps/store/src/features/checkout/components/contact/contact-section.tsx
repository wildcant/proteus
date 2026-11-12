import { Trans, useLingui } from '@lingui/react/macro'
import type { StoreCartDetailResponseCart } from '#/api/generated/model'
import { ButtonLink } from '#/components/ui/button/button'
import { CheckoutAccount } from '#/features/checkout/components/checkout-account/checkout-account'
import { CheckoutSection } from '#/features/checkout/components/checkout-section/checkout-section'
import { ContactForm } from '#/features/checkout/components/contact-form/contact-form'
import type { CheckoutData } from '#/features/checkout/hooks/use-checkout-data'
import type { CheckoutForm } from '#/features/checkout/hooks/use-checkout-form'
import type { LinkTarget } from '#/lib/link-target'

type ContactSectionProps = Pick<CheckoutData, 'isGuestCheckout'> & {
  cart: StoreCartDetailResponseCart
  form: CheckoutForm
  onSignOut: () => void
  /** SIGN_IN, coming back here. */
  signInLink: LinkTarget
  className?: string
}
export function ContactSection(props: ContactSectionProps) {
  const { isGuestCheckout, cart, form, onSignOut, signInLink, className } = props
  const { t } = useLingui()

  if (!isGuestCheckout) {
    return <CheckoutAccount email={cart.email} onSignOut={onSignOut} className={className} />
  }

  return (
    <CheckoutSection
      title={t`Contact`}
      className={className}
      action={
        <ButtonLink {...signInLink} variant="link">
          <Trans>Sign in</Trans>
        </ButtonLink>
      }
    >
      <ContactForm form={form} />
    </CheckoutSection>
  )
}
