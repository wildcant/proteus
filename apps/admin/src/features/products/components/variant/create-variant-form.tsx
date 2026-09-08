import { Button, KeyboundForm, RouteFocusModal, toast, useRouteModal } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { InfoIcon } from 'lucide-react'
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
      {/* No handler when there is nothing left to create: ⌘+Enter would otherwise run the
          validator and answer "Pick a combination" to a merchant who has none to pick. */}
      <KeyboundForm
        onSubmit={isExhausted ? undefined : form.handleSubmit}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <form.AppForm>
          <RouteFocusModal.Header />

          <RouteFocusModal.Body>
            <div className="mx-auto w-full max-w-180 space-y-6 px-6 py-10">
              <div>
                <h1 className="font-medium text-xl">Variant details</h1>
                <p className="text-muted-foreground text-sm">
                  A variant is one combination of this product's option values. Combinations it already has are left
                  out.
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

          {/* Nothing left to create, so nothing to offer: the actions give way to the reason. This is
              the shape a form takes when it has no submit — never a Create the merchant cannot press. */}
          <RouteFocusModal.Footer className={isExhausted ? 'justify-start' : undefined}>
            {isExhausted ? (
              <p className="flex items-center gap-x-2 text-blue-500 text-sm dark:text-blue-400">
                <InfoIcon className="size-4 shrink-0" aria-hidden="true" />
                Every combination of this product's options already has a variant.
              </p>
            ) : (
              <>
                <RouteFocusModal.Close render={<Button variant="secondary" size="sm" />}>Cancel</RouteFocusModal.Close>
                <form.SubmitButton size="sm" isPending={isPending || isLoading}>
                  Create
                </form.SubmitButton>
              </>
            )}
          </RouteFocusModal.Footer>
        </form.AppForm>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
