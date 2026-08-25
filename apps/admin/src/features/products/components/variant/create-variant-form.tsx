import { Button, KeyboundForm, RouteFocusModal, toast, useRouteModal } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { useCreateVariantForm } from '#/features/products/hooks/use-create-variant-form'
import { useOptionCombinationSearch } from '#/features/products/hooks/use-option-combination-search'

export function CreateVariantForm({ productId }: { productId: string }) {
  const { handleSuccess } = useRouteModal()

  // The combobox is this component's concern, so the search lives here rather than being proxied
  // back out through the form hook.
  const { combinations, onSearchChange, isExhausted, hasNoOptions, isPending } = useOptionCombinationSearch({
    productId,
  })

  const { form, isLoading } = useCreateVariantForm({
    productId,
    params: {
      onSuccess: (data) => {
        toast.add({ type: 'success', title: 'Variant created successfully' })
        handleSuccess(`/products/${productId}/variants/${data.variant.id}`)
      },
    },
  })

  if (hasNoOptions) {
    return (
      <>
        <RouteFocusModal.Header />
        <RouteFocusModal.Body>
          <p className="mx-auto w-full max-w-180 px-6 py-16 text-muted-foreground text-sm">
            This product has no options yet. A variant is one combination of a product's option values, so{' '}
            <Link to="/products/$id/options" params={{ id: productId }} className="underline">
              add some options
            </Link>{' '}
            first.
          </p>
        </RouteFocusModal.Body>
      </>
    )
  }

  return (
    <RouteFocusModal.Form form={form}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        <RouteFocusModal.Header />

        <RouteFocusModal.Body>
          <div className="mx-auto w-full max-w-180 space-y-6 px-6 py-10">
            <div>
              <h1 className="font-medium text-xl">Variant details</h1>
              <p className="text-muted-foreground text-sm">
                A variant is one combination of this product's option values. Combinations it already has are left out.
              </p>
            </div>

            {/* One field, because picking a combination is one choice. The list arrives already
                filtered to what is still available, so nothing here decides what may be picked. */}
            <form.AppField name="combination">
              {(field) => (
                <field.SingleComboboxField
                  label="Combination"
                  items={combinations}
                  onInputValueChange={onSearchChange}
                  disabled={isExhausted}
                  placeholder="Search combinations..."
                  emptyMessage="No combinations left."
                  description={
                    isExhausted ? "Every combination of this product's options already has a variant." : undefined
                  }
                />
              )}
            </form.AppField>

            {/* No title field: it is the combination's label. Shown read-only so the shopkeeper can
                see what the variant will be called on a line item. */}
            <form.Subscribe selector={(state) => state.values.combination?.label}>
              {(label) => (
                <div>
                  <span className="mb-1.5 block font-medium text-sm">Title</span>
                  <p className="text-muted-foreground text-sm">{label || 'Pick a combination to see the title.'}</p>
                </div>
              )}
            </form.Subscribe>

            <form.AppField name="sku">
              {(field) => <field.TextField label="SKU" placeholder="Optional" />}
            </form.AppField>
          </div>
        </RouteFocusModal.Body>

        <RouteFocusModal.Footer>
          <RouteFocusModal.Close render={<Button variant="secondary" size="sm" />}>Cancel</RouteFocusModal.Close>
          <Button type="submit" size="sm" disabled={isPending || isLoading || isExhausted}>
            Create
          </Button>
        </RouteFocusModal.Footer>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
