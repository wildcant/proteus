import { useLingui } from '@lingui/react/macro'
import { withForm } from '#/lib/form-hook'
import { checkoutFormOpts } from '../../hooks/use-checkout-form'

export const ContactForm = withForm({
  ...checkoutFormOpts,
  render: function ContactForm({ form }) {
    const { t } = useLingui()
    return (
      <form.AppField name="email">
        {(field) => (
          <field.TextField
            label={t`Email`}
            type="email"
            autoComplete="email"
            help={t`Used for your order confirmation and cart reminders`}
          />
        )}
      </form.AppField>
    )
  },
})
