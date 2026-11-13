import { useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import type { StoreProductResponseProduct, StoreProductVariant } from '#/api/generated/model'
import {
  productSpecs,
  productSpecsLabel,
  productSpecsSpec,
  productSpecsValue,
} from '#/features/products/components/product-specs/product-specs.variants'

type ProductSpecsProps = {
  product: StoreProductResponseProduct
  variant: StoreProductVariant | undefined
  className?: string
}

/**
 * Only the facts the catalogue actually holds. Variant values win over product ones — a variant may
 * differ in fabric or weight — and rows with nothing behind them are left out entirely.
 */
export function ProductSpecs({ product, variant, className }: ProductSpecsProps) {
  const { t } = useLingui()
  const weight = variant?.weight ?? product.weight
  const specs = [
    { label: t`Ref.`, value: variant?.sku },
    { label: t`Material`, value: variant?.material ?? product.material },
    { label: t`Weight`, value: weight === null || weight === undefined ? null : `${weight} g` },
    { label: t`Made in`, value: product.originCountry },
  ].filter((spec) => !!spec.value)

  if (specs.length === 0) return null

  return (
    <dl className={cn(productSpecs(), className)}>
      {specs.map((spec) => (
        <div key={spec.label} className={productSpecsSpec()}>
          <dt className={productSpecsLabel()}>{spec.label}</dt>
          <dd className={cn(productSpecsValue(), 'tabular-nums')}>{spec.value}</dd>
        </div>
      ))}
    </dl>
  )
}
