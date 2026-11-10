import { Trans, useLingui } from '@lingui/react/macro'
import { KeyboundForm, RouteFocusModal, useRouteModal } from '@proteus/ui'
import { useUiCopy } from '#/hooks/use-ui-copy'
import { useValueForm, type ValueFormParams } from '#/hooks/use-value-form'

type CreateValueFormProps<TBody, TResponse> = Pick<ValueFormParams<TBody, TResponse>, 'schema' | 'save'> & {
  heading: string
  description: string
  placeholder: string
}

/** The create modal for an entity that is nothing but a `value` — a Product Type, a Product Tag. */
export function CreateValueForm<TBody, TResponse>({
  heading,
  description,
  placeholder,
  schema,
  save,
}: CreateValueFormProps<TBody, TResponse>) {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()

  const { form } = useValueForm({ schema, save, onSuccess: () => handleSuccess() })

  return (
    <RouteFocusModal.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteFocusModal.Header closeLabel={closeLabel} />
          <RouteFocusModal.Body>
            <div className="mx-auto flex w-full max-w-lg flex-col gap-y-8 py-16">
              <div>
                <h1 className="font-semibold text-2xl">{heading}</h1>
                <p className="text-muted-foreground text-sm">{description}</p>
              </div>
              <form.AppField name="value">
                {(field) => <field.TextField label={t`Value`} autoFocus placeholder={placeholder} />}
              </form.AppField>
            </div>
          </RouteFocusModal.Body>
          <RouteFocusModal.Footer>
            <form.SubmitButton size="sm">
              <Trans>Save</Trans>
            </form.SubmitButton>
          </RouteFocusModal.Footer>
        </form.AppForm>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
