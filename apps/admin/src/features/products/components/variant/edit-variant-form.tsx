import { Button } from '@proteus/ui'
import type { AdminProductVariant } from '#/api/generated/model'
import { KeyboundForm } from '#/components/modals/keybound-form'
import { RouteDrawer } from '#/components/modals/route-drawer/route-drawer'
import { useRouteModal } from '#/components/modals/route-modal-provider/use-route-modal'
import { SingleSelectCombobox } from '#/components/single-select-combobox'
import { useEditVariantForm } from '#/features/products/hooks/use-edit-variant-form'

type EditVariantFormProps = {
  productId: string
  variant: AdminProductVariant
}

export function EditVariantForm({ productId, variant }: EditVariantFormProps) {
  const { handleSuccess } = useRouteModal()

  const { form, available, onSearchChange, hasNoOptions, isLoading } = useEditVariantForm({
    productId,
    variant,
    params: { onSuccess: () => handleSuccess() },
  })

  return (
    <RouteDrawer.Form form={form}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <RouteDrawer.Header>
          <RouteDrawer.Title>Edit Variant</RouteDrawer.Title>
        </RouteDrawer.Header>
        <RouteDrawer.Body className="space-y-4">
          <form.AppField name="title">
            {(field) => <field.TextField label="Title" autoFocus placeholder="Variant title" />}
          </form.AppField>
          <form.AppField name="material">
            {(field) => <field.TextField label="Material" placeholder="Optional" />}
          </form.AppField>

          {/* The list already excludes combinations other variants hold, and already includes this
              variant's own — so moving it can never collide. */}
          {!hasNoOptions && (
            <form.Field name="combinationKey">
              {(field) => (
                <div>
                  <label htmlFor="combination" className="mb-1.5 block font-medium text-sm">
                    Combination
                  </label>
                  <SingleSelectCombobox
                    id="combination"
                    items={available.map((combination) => ({ id: combination.key, label: combination.label }))}
                    value={field.state.value || null}
                    onValueChange={(key) => field.handleChange(key ?? '')}
                    onInputValueChange={onSearchChange}
                    placeholder="Search combinations..."
                    emptyMessage="No combinations left."
                  />
                </div>
              )}
            </form.Field>
          )}

          <form.AppField name="sku">{(field) => <field.TextField label="SKU" placeholder="Optional" />}</form.AppField>
        </RouteDrawer.Body>
        <RouteDrawer.Footer>
          <RouteDrawer.Close render={<Button variant="secondary" size="sm" />}>Cancel</RouteDrawer.Close>
          <Button type="submit" size="sm" disabled={isLoading}>
            Save
          </Button>
        </RouteDrawer.Footer>
      </KeyboundForm>
    </RouteDrawer.Form>
  )
}
