import { Field } from '@proteus/ui'
import { useId } from 'react'
import { useCountryName } from '#/api/countries'
import { FloatingLabelInput } from '#/components/form/input.tsx'
import { useFieldContext } from '#/lib/form-context.ts'
import { useMarket } from '#/lib/use-market'

/**
 * Where a parcel is going, which the market decides rather than the shopper.
 *
 * A field that reads rather than one that asks. The market a shopper is buying in is the country
 * the store can ship to, so offering a list here would only be offering ways to be refused — and
 * the refusal would arrive at the end of a filled-in checkout. Read-only rather than disabled: the
 * value is still selectable and copyable, and screen readers announce it as read-only rather than
 * as a control that has been taken away.
 *
 * It names the country the field *holds*, not the market's, which are the same thing everywhere a
 * shopper types a new address. They differ on one screen — editing an address saved while shopping
 * in another market — and there the address's own country is the truthful answer. Showing the
 * market's would be claiming a row says something it does not, one Save away from making it true.
 */
export function DeliveryCountryField({ className }: { className?: string }) {
  const field = useFieldContext<string>()
  const { current } = useMarket()
  const countryName = useCountryName()
  const id = useId()

  // The market's own country needs no request: the router already resolved its name, and this is
  // the case every new address takes. Only an address from elsewhere waits on the ISO listing.
  const code = field.state.value || current.iso2
  const name = code === current.iso2 ? current.displayName : countryName(code)

  return (
    <Field className={className}>
      <FloatingLabelInput id={id} label="Country" name={field.name} value={name ?? ''} readOnly />
    </Field>
  )
}
