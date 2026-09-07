import { Button, KeyboundForm, RouteFocusModal, useRouteModal } from '@proteus/ui'
import { CountryLocaleSelect } from '#/features/regions/components/country-locale-select'
import { useAddCountriesForm } from '#/features/regions/hooks/use-add-countries-form'
import { assignmentIsComplete } from '#/features/regions/utils/country-locale'

export function AddCountriesForm({ regionId }: { regionId: string }) {
  const { handleSuccess } = useRouteModal()

  const { form } = useAddCountriesForm(regionId, {
    onSuccess: () => handleSuccess(),
  })

  return (
    <RouteFocusModal.Form form={form}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <RouteFocusModal.Header />
        <RouteFocusModal.Body>
          <div className="mx-auto flex w-full max-w-lg flex-col gap-y-8 py-16">
            <div>
              <h1 className="font-semibold text-2xl">Add Countries</h1>
              <p className="text-muted-foreground text-sm">
                Assigning a country to this region is what makes it sellable. Only countries no region covers yet are
                offered.
              </p>
            </div>
            <form.Field name="countries">
              {(field) => <CountryLocaleSelect value={field.state.value} onChange={field.handleChange} />}
            </form.Field>
          </div>
        </RouteFocusModal.Body>
        <RouteFocusModal.Footer>
          <RouteFocusModal.Close render={<Button variant="secondary" size="sm" />}>Cancel</RouteFocusModal.Close>
          {/* Disabled rather than submitted-and-refused: a country with no locale is the one mistake
              this form exists to make impossible, so it never reaches the API. */}
          <form.Subscribe selector={(state) => state.values.countries}>
            {(countries) => (
              <Button type="submit" size="sm" disabled={!assignmentIsComplete(countries)}>
                Save
              </Button>
            )}
          </form.Subscribe>
        </RouteFocusModal.Footer>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
