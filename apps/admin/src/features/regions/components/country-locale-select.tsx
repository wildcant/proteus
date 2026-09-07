import { Field, FieldLabel, Input } from '@proteus/ui'
import { useId } from 'react'
import { MultiSelectCombobox } from '#/components/multi-select-combobox'
import { useSelectableCountries } from '#/features/regions/api/countries'
import {
  type CountryAssignment,
  reconcileAssignments,
  selectableCountries,
} from '#/features/regions/utils/country-locale'

type CountryLocaleSelectProps = {
  value: CountryAssignment[]
  onChange: (countries: CountryAssignment[]) => void
}

/**
 * Picks countries and collects a locale for each.
 *
 * The two halves are one field because the API takes them as one: assigning a region is what makes
 * a country sellable, and the locale is what its storefront's URL segment, `lang` attribute and
 * every number and date formatter come from. A picker that only chose countries would let a
 * merchant submit a market that renders broken — so the locale rows appear the moment a country is
 * selected, pre-filled with the most likely tag and editable, because the merchant owns it.
 */
export function CountryLocaleSelect({ value, onChange }: CountryLocaleSelectProps) {
  const { data, isPending } = useSelectableCountries()
  const available = selectableCountries(data?.countries ?? [])

  const items = available.map((country) => ({
    id: country.id,
    label: `${country.displayName} (${country.id.toUpperCase()})`,
  }))
  const displayNames = new Map(available.map((country) => [country.id, country.displayName]))

  return (
    <div className="flex flex-col gap-y-6">
      <div>
        <h2 className="font-medium text-sm">Countries</h2>
        <p className="mb-3 text-muted-foreground text-sm">Add the countries included in this region.</p>
        <MultiSelectCombobox
          items={items}
          value={value.map((country) => country.id)}
          onValueChange={(ids) => onChange(reconcileAssignments(value, ids))}
          placeholder="Search countries..."
          emptyMessage={isPending ? 'Loading countries…' : 'No countries left to add.'}
        />
      </div>

      {value.length > 0 && (
        <div className="flex flex-col gap-y-4">
          <div>
            <h2 className="font-medium text-sm">Locales</h2>
            <p className="text-muted-foreground text-sm">
              Each country's locale is its storefront's URL segment, and the tag its prices and dates are formatted
              with. The suggestion is the most common one — change it where it is wrong.
            </p>
          </div>
          {value.map((assignment) => (
            <CountryLocaleField
              key={assignment.id}
              label={displayNames.get(assignment.id) ?? assignment.id.toUpperCase()}
              localeCode={assignment.localeCode}
              onLocaleChange={(localeCode) =>
                onChange(value.map((country) => (country.id === assignment.id ? { ...country, localeCode } : country)))
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

type CountryLocaleFieldProps = {
  label: string
  localeCode: string
  onLocaleChange: (localeCode: string) => void
}

function CountryLocaleField({ label, localeCode, onLocaleChange }: CountryLocaleFieldProps) {
  const id = useId()

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={localeCode}
        onChange={(event) => onLocaleChange(event.target.value)}
        placeholder="e.g. es-CO"
      />
    </Field>
  )
}
