import { NativeSelectOption } from '@proteus/ui'
import { useCountries } from '#/api/countries'

/**
 * Every country there is, for the one address field a shopper still chooses: the billing one.
 *
 * The full ISO listing rather than the sellable one on purpose — a card is registered where its
 * holder banks, which need not be anywhere the store ships to, and refusing that country would
 * decline a card that was going to work. Where the parcel goes is a different question, and the
 * market has already answered it.
 */
export function CountryOptions() {
  const { countries } = useCountries('all')

  return (
    <>
      {countries.map((country) => (
        <NativeSelectOption key={country.iso2} value={country.iso2}>
          {country.displayName}
        </NativeSelectOption>
      ))}
    </>
  )
}
