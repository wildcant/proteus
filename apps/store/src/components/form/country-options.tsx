import { NativeSelectOption } from '@proteus/ui'
import { COUNTRIES } from './countries'

export function CountryOptions() {
  return (
    <>
      {COUNTRIES.map((country) => (
        <NativeSelectOption key={country.code} value={country.code}>
          {country.name}
        </NativeSelectOption>
      ))}
    </>
  )
}
