import { Button, KeyboundForm, RouteFocusModal, useRouteModal } from '@proteus/ui'
import { CurrencySelect } from '#/features/store/components/currency-select'
import { useAddCurrenciesForm } from '#/features/store/hooks/use-add-currencies-form'

export function AddCurrenciesForm() {
  const { handleSuccess } = useRouteModal()

  const { form } = useAddCurrenciesForm({
    onSuccess: () => handleSuccess(),
  })

  return (
    <RouteFocusModal.Form form={form}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <RouteFocusModal.Header />
        <RouteFocusModal.Body>
          <div className="mx-auto flex w-full max-w-lg flex-col gap-y-8 py-16">
            <div>
              <h1 className="font-semibold text-2xl">Add Currencies</h1>
              <p className="text-muted-foreground text-sm">
                The currencies the store sells in are the prices a product can carry, and the money a region may settle
                in.
              </p>
            </div>
            <form.Field name="currencyCodes">
              {(field) => <CurrencySelect value={field.state.value} onChange={field.handleChange} />}
            </form.Field>
          </div>
        </RouteFocusModal.Body>
        <RouteFocusModal.Footer>
          <RouteFocusModal.Close render={<Button variant="secondary" size="sm" />}>Cancel</RouteFocusModal.Close>
          {/* Disabled rather than submitted-and-refused: the schema requires at least one code, and
              a submit that is silently blocked by a validator is a button that does nothing. */}
          <form.Subscribe selector={(state) => state.values.currencyCodes}>
            {(currencyCodes) => (
              <Button type="submit" size="sm" disabled={currencyCodes.length === 0}>
                Save
              </Button>
            )}
          </form.Subscribe>
        </RouteFocusModal.Footer>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
