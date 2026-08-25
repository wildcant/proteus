import type { StoreCart } from '#/api/generated/model'
import { Button } from '#/components/button'
import { Form } from '#/components/form/form.tsx'
import { type ContactFormValues, useContactForm } from '#/features/checkout/hooks/use-contact-form'

type ContactFormProps = {
  cart: Pick<StoreCart, 'email'>
  onComplete: () => void
}

function getContactDefaults(cart: Pick<StoreCart, 'email'>): ContactFormValues | undefined {
  if (!cart.email) return undefined
  return { email: cart.email, firstName: '', lastName: '' }
}

export function ContactForm({ cart, onComplete }: ContactFormProps) {
  const { form, isPending, error } = useContactForm({
    defaultValues: getContactDefaults(cart),
    onSuccess: onComplete,
  })

  return (
    <Form onSubmit={form.handleSubmit}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <form.AppField name="email">
          {(field) => <field.TextField label="Email" type="email" autoComplete="email" className="sm:col-span-2" />}
        </form.AppField>
        <form.AppField name="firstName">
          {(field) => <field.TextField label="First name" autoComplete="given-name" />}
        </form.AppField>
        <form.AppField name="lastName">
          {(field) => <field.TextField label="Last name" autoComplete="family-name" />}
        </form.AppField>
      </div>

      <Button type="submit" disabled={isPending} className="mt-6">
        {isPending ? 'Saving...' : 'Continue to shipping'}
      </Button>

      {!!error && <p className="mt-2 text-red-600 text-sm">{error.message}</p>}
    </Form>
  )
}
