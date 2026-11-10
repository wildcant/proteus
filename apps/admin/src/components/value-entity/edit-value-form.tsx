import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteDrawer, useRouteModal } from '@proteus/ui'
import { useUiCopy } from '#/hooks/use-ui-copy'
import { useValueForm, type ValueFormParams } from '#/hooks/use-value-form'

type EditValueFormProps<TBody, TResponse> = Pick<ValueFormParams<TBody, TResponse>, 'value' | 'schema' | 'save'> & {
  heading: string
}

/** The rename drawer for an entity that is nothing but a `value` — a Product Type, a Product Tag. */
export function EditValueForm<TBody, TResponse>({
  heading,
  value,
  schema,
  save,
}: EditValueFormProps<TBody, TResponse>) {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()

  const { form } = useValueForm({ value, schema, save, onSuccess: () => handleSuccess() })

  return (
    <RouteDrawer.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteDrawer.Header closeLabel={closeLabel}>
            <RouteDrawer.Title>{heading}</RouteDrawer.Title>
          </RouteDrawer.Header>
          <RouteDrawer.Body className="flex flex-col gap-y-6">
            <form.AppField name="value">{(field) => <field.TextField label={t`Value`} autoFocus />}</form.AppField>
          </RouteDrawer.Body>
          <RouteDrawer.Footer>
            <RouteDrawer.Close render={<Button variant="secondary" size="sm" />}>
              <Trans>Cancel</Trans>
            </RouteDrawer.Close>
            <form.SubmitButton size="sm">
              <Trans>Save</Trans>
            </form.SubmitButton>
          </RouteDrawer.Footer>
        </form.AppForm>
      </KeyboundForm>
    </RouteDrawer.Form>
  )
}
