import { useLingui } from '@lingui/react/macro'
import { contactForm, contactFormEmail } from '#/features/checkout/components/contact-form/contact-form.variants'
import { checkoutFormOpts } from '#/features/checkout/hooks/use-checkout-form'
import { withForm } from '#/lib/form-hook'

export const ContactForm = withForm({
  ...checkoutFormOpts,
  render: function ContactForm({ form }) {
    const { t } = useLingui()
    return (
      <div className={contactForm()}>
        <form.AppField name="email">
          {(field) => (
            <field.TextField
              label={t`Email`}
              type="email"
              autoComplete="email"
              help={t`Used for your order confirmation and cart reminders`}
              className={contactFormEmail()}
            />
          )}
        </form.AppField>
      </div>
    )
  },
})
