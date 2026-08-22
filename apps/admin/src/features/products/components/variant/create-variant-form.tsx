import { Button, toast } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { KeyboundForm } from '#/components/modals/keybound-form'
import { RouteFocusModal } from '#/components/modals/route-focus-modal/route-focus-modal'
import { useRouteModal } from '#/components/modals/route-modal-provider/use-route-modal'
import { SingleSelectCombobox } from '#/components/single-select-combobox'
import { useCreateVariantForm } from '#/features/products/hooks/use-create-variant-form'
import { useOptionCombinationSearch } from '#/features/products/hooks/use-option-combination-search'

export function CreateVariantForm({ productId }: { productId: string }) {
  const { handleSuccess } = useRouteModal()

  // The combobox is this component's concern, so the search lives here rather than being proxied
  // back out through the form hook.
  const { combinations, combinationFor, onSearchChange, isExhausted, hasNoOptions, isPending } =
    useOptionCombinationSearch({ productId })

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
        <RouteFocusModal.Body className="mx-auto w-full max-w-180 px-6 py-16">
          <p className="text-muted-foreground text-sm">
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

        <RouteFocusModal.Body className="mx-auto w-full max-w-180 space-y-6 px-6 py-10">
          <div>
            <h1 className="font-medium text-xl">Variant details</h1>
            <p className="text-muted-foreground text-sm">
              A variant is one combination of this product's option values. Combinations it already has are left out.
            </p>
          </div>

          {/* One field, because picking a combination is one choice. The list arrives already
              filtered to what is still available, so nothing here decides what may be picked. */}
          <form.Field name="combination">
            {(field) => (
              <div>
                <label htmlFor="combination" className="mb-1.5 block font-medium text-sm">
                  Combination
                </label>
                <SingleSelectCombobox
                  id="combination"
                  items={combinations.map((combination) => ({ id: combination.key, label: combination.label }))}
                  value={field.state.value?.key ?? null}
                  onValueChange={(key) => field.handleChange(combinationFor(key))}
                  onInputValueChange={onSearchChange}
                  disabled={isExhausted}
                  placeholder="Search combinations..."
                  emptyMessage="No combinations left."
                />
                {isExhausted ? (
                  <p className="mt-1.5 text-muted-foreground text-sm">
                    Every combination of this product's options already has a variant.
                  </p>
                ) : null}
              </div>
            )}
          </form.Field>

          {/* The placeholder is what the server would derive, so it shows what leaving this blank
              will produce. */}
          <form.Subscribe selector={(state) => state.values.combination?.label}>
            {(label) => (
              <form.AppField name="title">
                {(field) => <field.TextField label="Title" placeholder={label ?? 'Optional'} />}
              </form.AppField>
            )}
          </form.Subscribe>

          <form.AppField name="sku">{(field) => <field.TextField label="SKU" placeholder="Optional" />}</form.AppField>
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
