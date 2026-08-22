import { Button, Checkbox, Input, Label, toast } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import type { AdminProductOption, AdminProductVariant } from '#/api/generated/model'
import { RouteFocusModal } from '#/components/modals/route-focus-modal/route-focus-modal'
import { useRouteModal } from '#/components/modals/route-modal-provider/use-route-modal'
import { useCreateVariantsForm } from '#/features/products/hooks/use-create-variants-form'

type CreateVariantsFormProps = {
  productId: string
  options: AdminProductOption[]
  existingVariants: AdminProductVariant[]
}

export function CreateVariantsForm({ productId, options, existingVariants }: CreateVariantsFormProps) {
  const { handleSuccess } = useRouteModal()

  const form = useCreateVariantsForm({
    productId,
    options,
    existingVariants,
    params: {
      onSuccess: (data) => {
        const created = data.variants
        toast.add({
          type: 'success',
          title: created.length === 1 ? 'Variant created successfully' : `${created.length} variants created`,
        })
        // One variant has a detail page worth landing on; a whole matrix does not, so the
        // product page — which lists them all — is where a batch belongs.
        const single = created.length === 1 ? created[0] : undefined
        handleSuccess(single ? `/products/${productId}/variants/${single.id}` : `/products/${productId}`)
      },
    },
  })

  if (options.length === 0) {
    return (
      <>
        <RouteFocusModal.Header />
        <RouteFocusModal.Body className="mx-auto w-full max-w-180 px-6 py-16">
          <p className="text-muted-foreground text-sm">
            This product has no options yet. Variants are generated from the options a product offers, so{' '}
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
    <>
      <RouteFocusModal.Header />

      <RouteFocusModal.Body className="mx-auto w-full max-w-180 space-y-8 px-6 py-10">
        <section className="space-y-4">
          <div>
            <h2 className="font-medium text-sm">Values</h2>
            <p className="text-muted-foreground text-sm">Every combination of the ticked values becomes a variant.</p>
          </div>
          {options.map((option) => (
            <div key={option.id} className="space-y-2">
              <span className="font-medium text-sm">{option.title}</span>
              <div className="flex flex-wrap gap-3">
                {option.values.map((value) => (
                  <Label key={value.id} className="flex items-center gap-2 font-normal text-sm">
                    <Checkbox
                      checked={(form.selectedValueIds[option.id] ?? []).includes(value.id)}
                      onCheckedChange={() => form.toggleValue(option.id, value.id)}
                    />
                    {value.value}
                  </Label>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-2">
          <Label htmlFor="sku-prefix">SKU prefix</Label>
          <Input
            id="sku-prefix"
            value={form.skuPrefix}
            placeholder="Optional, e.g. SHIRT"
            onChange={(event) => form.setSkuPrefix(event.target.value)}
          />
        </section>

        <section className="space-y-2">
          <div>
            <h2 className="font-medium text-sm">Variants to create</h2>
            <p className="text-muted-foreground text-sm">
              Combinations this product already has are left out. Untick a row to skip it.
            </p>
          </div>
          {form.rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing to create — pick at least one value for every option.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {form.rows.map((row) => (
                <li key={row.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <Checkbox checked={!form.excludedKeys[row.key]} onCheckedChange={() => form.toggleRow(row.key)} />
                  <span className="flex-1">{row.title}</span>
                  <span className="text-muted-foreground tabular-nums">{row.sku}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </RouteFocusModal.Body>

      <RouteFocusModal.Footer>
        <RouteFocusModal.Close render={<Button variant="secondary" size="sm" />}>Cancel</RouteFocusModal.Close>
        <Button type="button" size="sm" disabled={form.included.length === 0 || form.isLoading} onClick={form.submit}>
          Create {form.included.length > 0 ? form.included.length : ''} variant
          {form.included.length === 1 ? '' : 's'}
        </Button>
      </RouteFocusModal.Footer>
    </>
  )
}
