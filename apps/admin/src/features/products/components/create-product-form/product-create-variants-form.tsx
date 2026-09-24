import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { DataGrid } from '#/components/data-grid/data-grid'
import type { DataGridColumn } from '#/components/data-grid/types'
import { useProductOptions } from '#/features/product-options/api/product-options'
import { buildPriceColumns } from '#/features/products/utils/price-columns'
import { useStoreCurrencies } from '#/features/store/api/store'
import { withForm } from '#/lib/form-hook.ts'
import { productCreateFormOpts } from '../../hooks/use-create-product-form'
import type { GroupRefs } from './constants'
import { Tab } from './constants'
import { RegisterCreateProductFormStep } from './register-create-product-form-step'
import { variantsSchema } from './schemas'
import { fromVariantGridRows, toVariantGridRows, type VariantGridRow } from './variant-rows'

/**
 * One column for the combination, headed by the options it is made of — which is also the variant's
 * title, since a Variant Title is that label. A separate Title column would repeat it verbatim.
 *
 * Then one price column per currency the store sells in, so a product can be priced for every
 * market on the screen that creates it rather than in a second pass per variant.
 */
function buildColumns(optionTitles: string[], currencyCodes: string[], i18n: I18n): DataGridColumn<VariantGridRow>[] {
  return [
    { header: optionTitles.join(' / ') || i18n._(msg`Variant`), accessorKey: 'label', type: 'readonly' },
    { header: i18n._(msg`SKU`), accessorKey: 'sku', type: 'text' },
    ...buildPriceColumns(currencyCodes, i18n),
  ]
}

export const ProductCreateVariantsForm = withForm({
  ...productCreateFormOpts,
  props: { groupRefs: {} as GroupRefs },
  render: function ProductCreateVariantsForm({ form, groupRefs }) {
    const { i18n } = useLingui()
    const { data } = useProductOptions()
    const optionsById = new Map((data?.productOptions ?? []).map((option) => [option.id, option.title]))
    const { currencyCodes, isPending } = useStoreCurrencies()

    return (
      <form.FormGroup name="variants" validators={{ onSubmit: variantsSchema }}>
        {(formGroup) => (
          <>
            <RegisterCreateProductFormStep groupRefs={groupRefs} tab={Tab.VARIANTS} formGroup={formGroup} />
            <form.Subscribe selector={(state) => state.values.variants}>
              {(variants) => {
                if (!variants.hasVariants) {
                  return (
                    <p className="text-muted-foreground text-sm">
                      <Trans>This product is not sold in variations. A single variant will be created for it.</Trans>
                    </p>
                  )
                }

                if (variants.rows.length === 0) {
                  return (
                    <p className="text-muted-foreground text-sm">
                      <Trans>Pick options and values on the Details step to generate the variants.</Trans>
                    </p>
                  )
                }

                return (
                  <DataGrid
                    data={toVariantGridRows(variants.rows)}
                    columns={buildColumns(
                      variants.options.flatMap((entry) => optionsById.get(entry.optionId) ?? []),
                      currencyCodes,
                      i18n,
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
          </>
        )}
      </form.FormGroup>
    )
  },
})
