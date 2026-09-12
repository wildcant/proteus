import { DataGrid } from '#/components/data-grid/data-grid'
import type { DataGridColumn } from '#/components/data-grid/types'
import { useProductOptions } from '#/features/product-options/api/product-options'
import { buildPriceColumns } from '#/features/products/utils/price-columns'
import { useStoreCurrencies } from '#/features/store/api/store'
import { withForm } from '#/lib/form-hook.ts'
import { productCreateFormOpts } from '../../hooks/use-create-product-form'
import type { GroupRefs } from './constants'
import { Tab } from './constants'
import { variantsSchema } from './schemas'
import { useRegisterCreateProductFormStep } from './use-register-create-product-form-step'
import { fromVariantGridRows, toVariantGridRows, type VariantGridRow } from './variant-rows'

/**
 * One column for the combination, headed by the options it is made of — which is also the variant's
 * title, since a Variant Title is that label. A separate Title column would repeat it verbatim.
 *
 * Then one price column per currency the store sells in, so a product can be priced for every
 * market on the screen that creates it rather than in a second pass per variant.
 */
function buildColumns(optionTitles: string[], currencyCodes: string[]): DataGridColumn<VariantGridRow>[] {
  return [
    { header: optionTitles.join(' / ') || 'Variant', accessorKey: 'label', type: 'readonly' },
    { header: 'SKU', accessorKey: 'sku', type: 'text' },
    ...buildPriceColumns(currencyCodes),
  ]
}

export const ProductCreateVariantsForm = withForm({
  ...productCreateFormOpts,
  props: { groupRefs: {} as GroupRefs },
  render: function ProductCreateVariantsForm({ form, groupRefs }) {
    const { data } = useProductOptions()
    const optionsById = new Map((data?.productOptions ?? []).map((option) => [option.id, option.title]))
    const { currencyCodes, isPending } = useStoreCurrencies()

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
                    data={toVariantGridRows(variants.rows)}
                    columns={buildColumns(
                      variants.options.flatMap((entry) => optionsById.get(entry.optionId) ?? []),
                      currencyCodes,
                    )}
                    onChange={(gridRows) =>
                      form.setFieldValue('variants', {
                        ...variants,
                        rows: fromVariantGridRows(variants.rows, gridRows),
                      })
                    }
                    isLoading={isPending}
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
