import { Trans, useLingui } from '@lingui/react/macro'
import { KeyboundForm, RouteFocusModal, useRouteModal } from '@proteus/ui'
import { CollectionThumbnailPicker } from '#/features/collections/components/collection-thumbnail-picker'
import { useCreateCollectionForm } from '#/features/collections/hooks/use-create-collection-form'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function CreateCollectionForm() {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()

  const { form } = useCreateCollectionForm({
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
                  <Trans>Create Collection</Trans>
                </h1>
                <p className="text-muted-foreground text-sm">
                  <Trans>Hand-pick products for a campaign or a season.</Trans>
                </p>
              </div>
              <form.AppField name="title">
                {(field) => <field.TextField label={t`Title`} autoFocus placeholder={t`e.g. Summer 2026`} />}
              </form.AppField>
              <form.AppField name="handle">
                {(field) => <field.TextField label={t`Handle`} placeholder={t`Generated from the title when blank`} />}
              </form.AppField>
              <form.Field name="thumbnail">
                {(field) => <CollectionThumbnailPicker value={field.state.value} onValueChange={field.handleChange} />}
              </form.Field>
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
