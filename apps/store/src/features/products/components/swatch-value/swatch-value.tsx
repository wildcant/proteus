import { cn } from '@proteus/ui-core'
import { swatchValue } from '#/features/products/components/swatch-value/swatch-value.variants'
import { ValueInput, type ValueProps, valueState } from '#/features/products/components/variant-picker/value-input'

/**
 * A colourway tile.
 *
 * 4:5 rather than a disc: `swatchImageUrl` is a photograph of the garment, and a 44px circle crops
 * it to an average colour the catalogue does not actually store. The border is 2px in both states
 * so nothing shifts when the selection moves.
 */
export function SwatchValue({ label, className, imageUrl, ...input }: ValueProps & { imageUrl: string | null }) {
  const state = valueState(input)

  return (
    // `relative` keeps the hidden radio inside the tile.
    <div className={cn('relative', className)}>
      <ValueInput {...input} ariaLabel={label} />
      <label
        htmlFor={input.id}
        className={cn(
          swatchValue({ state }),
          'cursor-pointer transition-colors peer-focus-visible:outline peer-focus-visible:outline-ink peer-focus-visible:-outline-offset-2 peer-disabled:cursor-not-allowed',
        )}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="aspect-4/5 w-full object-cover" />
        ) : (
          // Not drawn yet: every seeded swatch has its photograph.
          <span className="flex aspect-4/5 w-full items-center justify-center bg-surface-subtle text-[10px] text-ink-muted uppercase">
            {label.slice(0, 2)}
          </span>
        )}
      </label>
    </div>
  )
}
