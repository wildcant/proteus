import { DataGrid, type DataGridColumn } from '#/components/data-grid'
import { useProductOptions } from '#/features/product-options/api/product-options'
import { withForm } from '#/lib/form-hook.ts'
import { productCreateFormOpts } from '../../hooks/use-create-product-form'
import type { GroupRefs } from './constants'
import { Tab } from './constants'
import { variantsSchema } from './schemas'
import { useRegisterCreateProductFormStep } from './use-register-create-product-form-step'
import type { VariantRow } from './variant-rows'

/**
 * One column for the combination, headed by the options it is made of — which is also the variant's
 * title, since a Variant Title is that label. A separate Title column would repeat it verbatim.
 *
 * Only one price column: prices are written as `usd` throughout, and there is no store or region
 * module to source others from.
 */
function buildColumns(optionTitles: string[]): DataGridColumn<VariantRow>[] {
  return [
    { header: optionTitles.join(' / ') || 'Variant', accessorKey: 'label', type: 'readonly' },
    { header: 'SKU', accessorKey: 'sku', type: 'text' },
    { header: 'Price', accessorKey: 'price', type: 'currency', currencyCode: 'usd' },
  ]
}

export const ProductCreateVariantsForm = withForm({
  ...productCreateFormOpts,
  props: { groupRefs: {} as GroupRefs },
  render: function ProductCreateVariantsForm({ form, groupRefs }) {
    const { data } = useProductOptions()
    const optionsById = new Map((data?.productOptions ?? []).map((option) => [option.id, option.title]))

    return (
      <form.FormGroup name="variants" validators={{ onSubmit: variantsSchema }}>
        {(formGroup) => {
          useRegisterCreateProductFormStep(groupRefs, Tab.VARIANTS, formGroup)

          return (
            <form.Subscribe selector={(state) => state.values.variants}>
              {(variants) => {
                if (!variants.hasVariants) {
                  return (
                    <p className="text-muted-foreground text-sm">
                      This product is not sold in variations. A single variant will be created for it.
                    </p>
                  )
                }

                if (variants.rows.length === 0) {
                  return (
                    <p className="text-muted-foreground text-sm">
                      Pick options and values on the Details step to generate the variants.
                    </p>
                  )
                }

                return (
                  <DataGrid
                    data={variants.rows}
                    columns={buildColumns(variants.options.flatMap((entry) => optionsById.get(entry.optionId) ?? []))}
                    onChange={(rows) => form.setFieldValue('variants', { ...variants, rows })}
                  />
                )
              }}
            </form.Subscribe>
          )
        }}
      </form.FormGroup>
    )
  },
})
