import { Trans } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteFocusModal, useRouteModal } from '@proteus/ui'
import { CurrencySelect } from '#/features/store/components/currency-select'
import { useAddCurrenciesForm } from '#/features/store/hooks/use-add-currencies-form'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function AddCurrenciesForm() {
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()

  const { form } = useAddCurrenciesForm({
    onSuccess: () => handleSuccess(),
  })

  return (
    <RouteFocusModal.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteFocusModal.Header closeLabel={closeLabel} />
          <RouteFocusModal.Body>
            <div className="mx-auto flex w-full max-w-lg flex-col gap-y-8 py-16">
              <div>
                <h1 className="font-semibold text-2xl">
                  <Trans>Add Currencies</Trans>
                </h1>
                <p className="text-muted-foreground text-sm">
                  <Trans>
                    The currencies the store sells in are the prices a product can carry, and the money a region may
                    settle in.
                  </Trans>
                </p>
              </div>
              <form.Field name="currencyCodes">
                {(field) => (
                  <CurrencySelect
                    value={field.state.value}
                    onChange={field.handleChange}
                    errors={field.state.meta.isValid ? undefined : field.state.meta.errors}
                  />
                )}
              </form.Field>
            </div>
          </RouteFocusModal.Body>
          <RouteFocusModal.Footer>
            <RouteFocusModal.Close render={<Button variant="secondary" size="sm" />}>
              <Trans>Cancel</Trans>
            </RouteFocusModal.Close>
            <form.SubmitButton size="sm">
              <Trans>Save</Trans>
            </form.SubmitButton>
          </RouteFocusModal.Footer>
        </form.AppForm>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
