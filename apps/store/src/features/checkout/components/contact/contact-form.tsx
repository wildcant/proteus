import { withForm } from '#/lib/form-hook'
import { checkoutFormOpts } from '../../hooks/use-checkout-form'

export const ContactForm = withForm({
  ...checkoutFormOpts,
  render: function ContactForm({ form }) {
    return (
      <form.AppField name="email">
        {(field) => (
          <field.TextField
            label="Email"
            type="email"
            autoComplete="email"
            help="Used for your order confirmation and cart reminders"
          />
        )}
      </form.AppField>
    )
  },
})
