import { Button, TagInput } from '@proteus/ui'
import type { AdminProductOption } from '#/api/generated/model'
import { KeyboundForm } from '#/components/modals/keybound-form'
import { RouteDrawer } from '#/components/modals/route-drawer/route-drawer'
import { useRouteModal } from '#/components/modals/route-modal-provider/use-route-modal'
import { useEditProductOptionForm } from '#/features/product-options/hooks/use-edit-product-option-form'

export function EditProductOptionForm({ option }: { option: AdminProductOption }) {
  const { handleSuccess } = useRouteModal()

  const { form } = useEditProductOptionForm(option, {
    onSuccess: () => handleSuccess(),
  })

  return (
    <RouteDrawer.Form form={form}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <RouteDrawer.Header>
          <RouteDrawer.Title>Edit Product Option</RouteDrawer.Title>
        </RouteDrawer.Header>
        <RouteDrawer.Body className="flex flex-col gap-y-6">
          <form.AppField name="title">
            {(field) => <field.TextField label="Title" autoFocus placeholder="e.g. Color, Size" />}
          </form.AppField>
          <div>
            <h2 className="mb-2 font-medium text-sm">Values</h2>
            <form.Field name="values">
              {(field) => (
                <TagInput
                  value={(field.state.value ?? []).map((v) => ({ id: v.value, label: v.value }))}
                  onChange={(items) => field.handleChange(items.map((item, rank) => ({ value: item.label, rank })))}
                  placeholder="Type a value and press Enter"
                />
              )}
            </form.Field>
          </div>
        </RouteDrawer.Body>
        <RouteDrawer.Footer>
          <RouteDrawer.Close render={<Button variant="secondary" size="sm" />}>Cancel</RouteDrawer.Close>
          <Button type="submit" size="sm">
            Save
          </Button>
        </RouteDrawer.Footer>
      </KeyboundForm>
    </RouteDrawer.Form>
  )
}
