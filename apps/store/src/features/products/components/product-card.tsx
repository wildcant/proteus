import { Link } from '@tanstack/react-router'
import { PackageIcon } from 'lucide-react'
import type { StoreProductListItem } from '#/api/generated/model'
import { useFormatters } from '#/hooks/use-formatters'

export function ProductCard({ product, priority }: { product: StoreProductListItem; priority?: boolean }) {
  const { formatPrice } = useFormatters()

  return (
    <Link to="/products/$productId" params={{ productId: product.id }} className="group block no-underline">
      <div className="relative aspect-4/5 overflow-hidden bg-surface-subtle">
        {product.thumbnail ? (
          <img
            src={product.thumbnail}
            alt={product.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            fetchPriority={priority ? 'high' : undefined}
            loading={priority ? undefined : 'lazy'}
            // Matches the 4:5 box, so the browser reserves the right space before the image lands.
            width={600}
            height={750}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-line">
            <PackageIcon className="h-10 w-10" />
          </div>
        )}
        {/* Inside the image box and a sibling of the photograph, so the hover zoom moves the
            garment and leaves the label where it was. */}
        {product.soldOut ? <SoldOutBadge /> : null}
      </div>
      {/* No side inset on a phone: at a 4px column gutter a 185px card needs its full width for
          the title, and insetting would cost more than the 4px it buys. */}
      <div className="py-2 lg:p-4">
        <h3 className="font-normal text-ink text-sm">{product.title}</h3>
        {/* The fit line — the same string the PDP puts under its heading, so the card and the
            product page say the same thing about the same garment. */}
        {!!product.subtitle && <p className="mt-1 text-ink-muted text-sm">{product.subtitle}</p>}
        {!!product.startingPrice && (
          <p className="mt-4 font-bold text-ink text-sm">
            {/* `startingPrice` is the cheapest variant's, so a product whose sizes run $46 to $60
                would otherwise show a price no shopper can buy at without knowing which one. */}
            From {formatPrice(product.startingPrice.calculatedAmount, product.startingPrice.currencyCode)}
          </p>
        )}
      </div>
    </Link>
  )
}

/**
 * The one thing said over a photograph.
 *
 * Bottom left, where the reference design puts it: the top of a 4:5 crop is where the garment is,
 * and a label in the corner nearest the title reads as belonging to the card rather than floating
 * over the model.
 *
 * A pill, and the only rounded thing in a squared-off system. That is what tells the eye it is a
 * label laid on the image and not part of the photograph's own composition; `--radius: 0` squares
 * everything that sits *in* the grid, and this sits on top of it.
 */
function SoldOutBadge() {
  return (
    <span className="absolute bottom-2 left-2 rounded-full bg-surface px-2.5 py-1 font-medium text-ink text-xs">
      Sold out
    </span>
  )
}
