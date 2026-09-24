import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteFocusModal, Separator, useRouteModal } from '@proteus/ui'
import { RegionCurrencySelect } from '#/features/regions/components/region-currency-select'
import { RegionProviderSelect } from '#/features/regions/components/region-provider-select'
import { useCreateRegionForm } from '#/features/regions/hooks/use-create-region-form'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function CreateRegionForm() {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()

  const { form } = useCreateRegionForm({
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
                  <Trans>Create Region</Trans>
                </h1>
                <p className="text-muted-foreground text-sm">
                  <Trans>
                    A region is an area that you sell products in. It can cover multiple countries, and has its own
                    currency and payment providers.
                  </Trans>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <form.AppField name="name">
                  {(field) => <field.TextField label={t`Name`} autoFocus placeholder={t`e.g. Europe`} />}
                </form.AppField>
                <form.Field name="currencyCode">
                  {(field) => (
                    <RegionCurrencySelect
                      value={field.state.value}
                      onChange={field.handleChange}
                      errors={field.state.meta.isValid ? undefined : field.state.meta.errors}
                    />
                  )}
                </form.Field>
              </div>
              <Separator />
              <form.Field name="paymentProviderIds">
                {(field) => <RegionProviderSelect value={field.state.value ?? []} onChange={field.handleChange} />}
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
