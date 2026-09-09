import { Field, FieldError, FieldLabel, Input } from '@proteus/ui'
import { useId } from 'react'
import { MultiSelectCombobox } from '#/components/multi-select-combobox'
import { useSelectableCountries } from '#/features/regions/api/countries'
import { addCountriesFormOpts } from '#/features/regions/hooks/use-add-countries-form'
import { reconcileAssignments, selectableCountries } from '#/features/regions/utils/country-locale'
import { withForm } from '#/lib/form-hook.ts'

/**
 * Picks countries and collects a locale for each.
 *
 * The two halves are one field because the API takes them as one: assigning a region is what makes
 * a country sellable, and the locale is what its storefront's URL segment, `lang` attribute and
 * every number and date formatter come from. A picker that only chose countries would let a
 * merchant submit a market that renders broken — so the locale rows appear the moment a country is
 * selected, pre-filled with the most likely tag and editable, because the merchant owns it.
 *
 * Bound to the form rather than taking a value and an onChange, because each locale is its own
 * field: the schema reports a missing one at `countries[n].localeCode`, and only a field opened at
 * that path can put the message on the row it belongs to.
 */
export const CountryLocaleSelect = withForm({
  ...addCountriesFormOpts,
  render: function CountryLocaleSelect({ form }) {
    const { data, isPending } = useSelectableCountries()
    const available = selectableCountries(data?.countries ?? [])

    const items = available.map((country) => ({
      id: country.id,
      label: `${country.displayName} (${country.id.toUpperCase()})`,
    }))
    const displayNames = new Map(available.map((country) => [country.id, country.displayName]))

    return (
      <form.Field name="countries">
        {(field) => {
          const isInvalid = !field.state.meta.isValid

          return (
            <div className="flex flex-col gap-y-6">
              <Field data-invalid={isInvalid}>
                <h2 className="font-medium text-sm">Countries</h2>
                <p className="mb-3 text-muted-foreground text-sm">Add the countries included in this region.</p>
                <MultiSelectCombobox
                  items={items}
                  value={field.state.value.map((country) => country.id)}
                  onValueChange={(ids) => field.handleChange(reconcileAssignments(field.state.value, ids))}
                  placeholder="Search countries..."
                  emptyMessage={isPending ? 'Loading countries…' : 'No countries left to add.'}
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>

              {field.state.value.length > 0 && (
                <div className="flex flex-col gap-y-4">
                  <div>
                    <h2 className="font-medium text-sm">Locales</h2>
                    <p className="text-muted-foreground text-sm">
                      Each country's locale is its storefront's URL segment, and the tag its prices and dates are
                      formatted with. The suggestion is the most common one — change it where it is wrong.
                    </p>
                  </div>
                  {field.state.value.map((assignment, index) => (
                    <form.Field key={assignment.id} name={`countries[${index}].localeCode`}>
                      {(localeField) => (
                        <CountryLocaleField
                          label={displayNames.get(assignment.id) ?? assignment.id.toUpperCase()}
                          localeCode={localeField.state.value}
                          onLocaleChange={localeField.handleChange}
                          errors={localeField.state.meta.isValid ? undefined : localeField.state.meta.errors}
                        />
                      )}
                    </form.Field>
                  ))}
                </div>
              )}
            </div>
          )
        }}
      </form.Field>
    )
  },
})

type CountryLocaleFieldProps = {
  label: string
  localeCode: string
  onLocaleChange: (localeCode: string) => void
  errors?: Array<{ message?: string } | undefined>
}

function CountryLocaleField({ label, localeCode, onLocaleChange, errors }: CountryLocaleFieldProps) {
  const id = useId()
  const isInvalid = !!errors?.length

  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={localeCode}
        onChange={(event) => onLocaleChange(event.target.value)}
        placeholder="e.g. es-CO"
        aria-invalid={isInvalid}
      />
      {isInvalid && <FieldError errors={errors} />}
    </Field>
  )
}
