import { Link } from '@tanstack/react-router'
import { PackageIcon } from 'lucide-react'
import type { StoreProductListItem } from '#/api/generated/model'
import { useFormatters } from '#/lib/use-formatters'

export function ProductCard({ product, priority }: { product: StoreProductListItem; priority?: boolean }) {
  const { formatPrice } = useFormatters()

  return (
    <Link to="/products/$productId" params={{ productId: product.id }} className="group block no-underline">
      <div className="aspect-4/5 overflow-hidden bg-surface-subtle">
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
