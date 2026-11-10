import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteDrawer, useRouteModal } from '@proteus/ui'
import type { AdminProductCollection } from '#/api/generated/model'
import { CollectionThumbnailPicker } from '#/features/collections/components/collection-thumbnail-picker'
import { useEditCollectionForm } from '#/features/collections/hooks/use-edit-collection-form'
import { useUiCopy } from '#/hooks/use-ui-copy'

export function EditCollectionForm({ collection }: { collection: AdminProductCollection }) {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()

  const { form } = useEditCollectionForm(collection, {
    onSuccess: () => handleSuccess(),
  })

  return (
    <RouteDrawer.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteDrawer.Header closeLabel={closeLabel}>
            <RouteDrawer.Title>
              <Trans>Edit Collection</Trans>
            </RouteDrawer.Title>
          </RouteDrawer.Header>
          <RouteDrawer.Body className="flex flex-col gap-y-6">
            <form.AppField name="title">{(field) => <field.TextField label={t`Title`} autoFocus />}</form.AppField>
            <form.AppField name="handle">{(field) => <field.TextField label={t`Handle`} />}</form.AppField>
            <form.Field name="thumbnail">
              {(field) => <CollectionThumbnailPicker value={field.state.value} onValueChange={field.handleChange} />}
            </form.Field>
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
