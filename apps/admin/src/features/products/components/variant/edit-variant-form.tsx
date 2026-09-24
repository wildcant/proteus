import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteDrawer, useRouteModal } from '@proteus/ui'
import type { AdminProductVariant } from '#/api/generated/model'
import { useEditVariantForm } from '#/features/products/hooks/use-edit-variant-form'
import { useOptionCombinationSearch } from '#/features/products/hooks/use-option-combination-search'
import { useUiCopy } from '#/hooks/use-ui-copy'

type EditVariantFormProps = {
  productId: string
  variant: AdminProductVariant
}

export function EditVariantForm({ productId, variant }: EditVariantFormProps) {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()

  // Passing the variant's id is what keeps the combination it already holds in the list — a
  // variant must be able to keep its own, and everything else is taken by definition.
  const { combinations, current, onSearchChange, hasNoOptions } = useOptionCombinationSearch({
    productId,
    variantId: variant.id,
  })

  const { form } = useEditVariantForm({
    productId,
    variant,
    current,
    params: { onSuccess: () => handleSuccess() },
  })

  return (
    <RouteDrawer.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteDrawer.Header closeLabel={closeLabel}>
            <RouteDrawer.Title>
              <Trans>Edit Variant</Trans>
            </RouteDrawer.Title>
          </RouteDrawer.Header>
          <RouteDrawer.Body className="space-y-6">
            {/* Derived from the combination below, so it is shown rather than edited. */}
            <form.Subscribe selector={(state) => state.values.combination?.label}>
              {(label) => (
                <div>
                  <span className="mb-1.5 block font-medium text-sm">
                    <Trans>Title</Trans>
                  </span>
                  <p className="text-muted-foreground text-sm">{label || variant.title}</p>
                </div>
              )}
            </form.Subscribe>
            <form.AppField name="material">
              {(field) => <field.TextField label={t`Material`} placeholder={t`Optional`} />}
            </form.AppField>

            {hasNoOptions ? null : (
              <form.AppField name="combination">
                {(field) => (
                  <field.SingleComboboxField
                    label={t`Combination`}
                    items={combinations}
                    onInputValueChange={onSearchChange}
                    placeholder={t`Search combinations...`}
                    emptyMessage={t`No combinations left.`}
                  />
                )}
              </form.AppField>
            )}

            <div className="border-t pt-6">
              <h3 className="mb-4 font-medium text-sm">
                <Trans>Stock & Inventory</Trans>
              </h3>
              <div className="space-y-4">
                <form.AppField name="sku">
                  {(field) => <field.TextField label={t`SKU`} placeholder={t`Optional`} />}
                </form.AppField>
                <form.AppField name="barcode">
                  {(field) => <field.TextField label={t`Barcode`} placeholder={t`Optional`} />}
                </form.AppField>
                <form.AppField name="manageInventory">
                  {(field) => (
                    <field.SwitchField
                      label={t`Manage inventory`}
                      description={t`When enabled, stock is tracked and adjusted on orders and returns.`}
                    />
                  )}
                </form.AppField>
                <form.AppField name="allowBackorder">
                  {(field) => (
                    <field.SwitchField
                      label={t`Allow backorders`}
                      description={t`When enabled, the variant can be purchased even when out of stock.`}
                    />
                  )}
                </form.AppField>
              </div>
            </div>
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
