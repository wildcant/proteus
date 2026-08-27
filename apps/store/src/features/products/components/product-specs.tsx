import type { StoreProductResponseProduct, StoreProductVariant } from '#/api/generated/model'

type ProductSpecsProps = {
  product: StoreProductResponseProduct
  variant: StoreProductVariant | undefined
}

/**
 * Only the facts the catalogue actually holds. Variant values win over product ones — a variant may
 * differ in fabric or weight — and rows with nothing behind them are left out entirely.
 */
export function ProductSpecs({ product, variant }: ProductSpecsProps) {
  const weight = variant?.weight ?? product.weight
  const specs = [
    { label: 'Ref.', value: variant?.sku },
    { label: 'Material', value: variant?.material ?? product.material },
    { label: 'Weight', value: weight === null || weight === undefined ? null : `${weight} g` },
    { label: 'Made in', value: product.originCountry },
  ].filter((spec) => !!spec.value)

  if (specs.length === 0) return null

  return (
    <dl className="border-line border-t">
      {specs.map((spec) => (
        <div key={spec.label} className="flex justify-between gap-4 border-line border-b py-2.5">
          <dt className="text-ink-muted">{spec.label}</dt>
          <dd className="text-ink tabular-nums">{spec.value}</dd>
        </div>
      ))}
    </dl>
  )
}
