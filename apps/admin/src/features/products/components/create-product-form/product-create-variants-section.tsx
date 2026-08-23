import { Checkbox, Label } from '@proteus/ui'
import { SortableList } from '#/components/common/sortable-list'
import { useProductOptions } from '#/features/product-options/api/product-options'
import { OptionValueSelector } from '#/features/product-options/components/option-value-selector'
import { withForm } from '#/lib/form-hook.ts'
import { productCreateFormOpts } from '../../hooks/use-create-product-form'
import { enumerateVariantRows } from './variant-rows'

/**
 * Which options the product varies along, and the order its variants appear in.
 *
 * Lives on the Details step rather than beside the grid because the grid is a consequence of these
 * choices, not a peer of them — the same reason Shopify and Medusa both put it here.
 */
export const ProductCreateVariantsSection = withForm({
  ...productCreateFormOpts,
  render: function ProductCreateVariantsSection({ form }) {
    const { data } = useProductOptions()
    const allOptions = data?.productOptions ?? []

    return (
      <form.Subscribe selector={(state) => state.values.variants}>
        {(variants) => (
          <div className="flex flex-col gap-y-6">
            <h2 className="font-semibold text-xl">Variants</h2>

            <div className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                id="has-variants"
                checked={variants.hasVariants}
                onCheckedChange={(checked) => {
                  const hasVariants = checked === true
                  form.setFieldValue('variants', {
                    ...variants,
                    hasVariants,
                    // Clearing rather than hiding: a product saved without variations must not
                    // carry a matrix the shopkeeper turned off.
                    options: hasVariants ? variants.options : [],
                    rows: hasVariants ? variants.rows : [],
                  })
                }}
              />
              <div>
                <Label htmlFor="has-variants">Yes, this is a product with variants</Label>
                <p className="text-muted-foreground text-sm">
                  When unchecked, a single variant is created, named after the product.
                </p>
              </div>
            </div>

            {variants.hasVariants ? (
              <>
                <OptionValueSelector
                  allOptions={allOptions}
                  value={variants.options}
                  onChange={(options) =>
                    form.setFieldValue('variants', {
                      ...variants,
                      options,
                      // Rows are re-enumerated but carried by combination key, so an edited SKU
                      // survives adding a value elsewhere in the matrix.
                      rows: enumerateVariantRows(allOptions, options, variants.rows),
                    })
                  }
                />

                {variants.rows.length > 0 ? (
                  <div>
                    <h3 className="font-medium text-sm">Product variants</h3>
                    <p className="mb-3 text-muted-foreground text-sm">
                      This ranking will affect the variants' order in your storefront.
                    </p>
                    <div className="rounded-md border">
                      <SortableList
                        items={variants.rows.map((row) => ({ ...row, id: row.key }))}
                        onChange={(rows) =>
                          form.setFieldValue('variants', {
                            ...variants,
                            rows: rows.map(({ id: _id, ...row }) => row),
                          })
                        }
                        renderItem={(row) => (
                          <SortableList.Item id={row.id} className="items-center border-b px-2 py-1 last:border-b-0">
                            <SortableList.DragHandle />
                            <span className="text-sm">{row.label}</span>
                          </SortableList.Item>
                        )}
                      />
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        )}
      </form.Subscribe>
    )
  },
})
