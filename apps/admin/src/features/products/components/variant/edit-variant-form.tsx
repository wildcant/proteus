import { Button } from '@proteus/ui'
import type { AdminProductVariant } from '#/api/generated/model'
import { KeyboundForm } from '#/components/modals/keybound-form'
import { RouteDrawer } from '#/components/modals/route-drawer/route-drawer'
import { useRouteModal } from '#/components/modals/route-modal-provider/use-route-modal'
import { useEditVariantForm } from '#/features/products/hooks/use-edit-variant-form'
import { useOptionCombinationSearch } from '#/features/products/hooks/use-option-combination-search'

type EditVariantFormProps = {
  productId: string
  variant: AdminProductVariant
}

export function EditVariantForm({ productId, variant }: EditVariantFormProps) {
  const { handleSuccess } = useRouteModal()

  // Passing the variant's id is what keeps the combination it already holds in the list — a
  // variant must be able to keep its own, and everything else is taken by definition.
  const { combinations, current, onSearchChange, hasNoOptions, isPending } = useOptionCombinationSearch({
    productId,
    variantId: variant.id,
  })

  const { form, isLoading } = useEditVariantForm({
    productId,
    variant,
    current,
    params: { onSuccess: () => handleSuccess() },
  })

  return (
    <RouteDrawer.Form form={form}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <RouteDrawer.Header>
          <RouteDrawer.Title>Edit Variant</RouteDrawer.Title>
        </RouteDrawer.Header>
        <RouteDrawer.Body className="space-y-4">
          {/* Derived from the combination below, so it is shown rather than edited. */}
          <form.Subscribe selector={(state) => state.values.combination?.label}>
            {(label) => (
              <div>
                <span className="mb-1.5 block font-medium text-sm">Title</span>
                <p className="text-muted-foreground text-sm">{label || variant.title}</p>
              </div>
            )}
          </form.Subscribe>
          <form.AppField name="material">
            {(field) => <field.TextField label="Material" placeholder="Optional" />}
          </form.AppField>

          {/* The list already excludes combinations other variants hold, and already includes this
              variant's own — so moving it can never collide. */}
          {hasNoOptions ? null : (
            <form.AppField name="combination">
              {(field) => (
                <field.SingleComboboxField
                  label="Combination"
                  items={combinations}
                  onInputValueChange={onSearchChange}
                  placeholder="Search combinations..."
                  emptyMessage="No combinations left."
                />
              )}
            </form.AppField>
          )}

          <form.AppField name="sku">{(field) => <field.TextField label="SKU" placeholder="Optional" />}</form.AppField>
        </RouteDrawer.Body>
        <RouteDrawer.Footer>
          <RouteDrawer.Close render={<Button variant="secondary" size="sm" />}>Cancel</RouteDrawer.Close>
          <Button type="submit" size="sm" disabled={isPending || isLoading}>
            Save
          </Button>
        </RouteDrawer.Footer>
      </KeyboundForm>
    </RouteDrawer.Form>
  )
}
