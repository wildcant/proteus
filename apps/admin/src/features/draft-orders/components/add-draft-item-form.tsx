import { Trans, useLingui } from '@lingui/react/macro'
import { Button, KeyboundForm, RouteDrawer, useRouteModal } from '@proteus/ui'
import { useState } from 'react'
import { SingleComboboxField } from '#/components/form/single-combobox-field'
import { useAddDraftItemForm } from '#/features/draft-orders/hooks/use-add-draft-item-form'
import { useProductVariants } from '#/features/products/api/product-variants'
import { useProducts } from '#/features/products/api/products'
import { useDebouncedValue } from '#/hooks/use-debounced-value'
import { useUiCopy } from '#/hooks/use-ui-copy'

/** Adds a variant to the draft; the server prices it in the draft's region, as the Cart would have. */
export function AddDraftItemForm({ draftOrderId }: { draftOrderId: string }) {
  const { t } = useLingui()
  const { closeLabel, unsavedChanges } = useUiCopy()
  const { handleSuccess } = useRouteModal()
  const { form } = useAddDraftItemForm(draftOrderId, { onSuccess: () => handleSuccess() })

  const [productSearch, setProductSearch] = useState('')
  const { data: productData } = useProducts({ q: useDebouncedValue(productSearch) || undefined, limit: 20 })
  const products = (productData?.products ?? []).map((product) => ({ id: product.id, label: product.title }))

  return (
    <RouteDrawer.Form form={form} copy={unsavedChanges}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteDrawer.Header closeLabel={closeLabel}>
            <RouteDrawer.Title>
              <Trans>Add item</Trans>
            </RouteDrawer.Title>
            <RouteDrawer.Description>
              <Trans>The item is priced in the draft's region.</Trans>
            </RouteDrawer.Description>
          </RouteDrawer.Header>
          <RouteDrawer.Body className="flex flex-col gap-y-6">
            <form.AppField
              name="product"
              // A variant belongs to one product, so a new product clears the variant picked under the old one.
              listeners={{ onChange: () => form.setFieldValue('variant', null) }}
            >
              {(field) => (
                <field.SingleComboboxField
                  label={t`Product`}
                  items={products}
                  onInputValueChange={setProductSearch}
                  placeholder={t`Search products...`}
                  emptyMessage={t`No products found.`}
                />
              )}
            </form.AppField>
            <form.Subscribe selector={(state) => state.values.product?.id}>
              {(productId) => (
                <form.AppField name="variant">{() => <VariantCombobox productId={productId} />}</form.AppField>
              )}
            </form.Subscribe>
            <form.AppField name="quantity">{(field) => <field.NumberField label={t`Quantity`} />}</form.AppField>
          </RouteDrawer.Body>
          <RouteDrawer.Footer>
            <RouteDrawer.Close render={<Button variant="secondary" size="sm" />}>
              <Trans>Cancel</Trans>
            </RouteDrawer.Close>
            <form.SubmitButton size="sm">
              <Trans>Add</Trans>
            </form.SubmitButton>
          </RouteDrawer.Footer>
        </form.AppForm>
      </KeyboundForm>
    </RouteDrawer.Form>
  )
}

/** The chosen product's variants. Rendered inside the `form.AppField` that holds the chosen variant. */
function VariantCombobox({ productId }: { productId: string | undefined }) {
  const { t } = useLingui()
  const { data } = useProductVariants(productId ?? '', { limit: 100 }, { enabled: !!productId })
  const variants = productId
    ? (data?.variants ?? []).map((variant) => ({
        id: variant.id,
        label: variant.sku ? `${variant.title} · ${variant.sku}` : variant.title,
      }))
    : []

  return (
    <SingleComboboxField
      label={t`Variant`}
      items={variants}
      disabled={!productId}
      placeholder={productId ? t`Search variants...` : t`Pick a product first`}
      emptyMessage={t`No variants.`}
    />
  )
}
