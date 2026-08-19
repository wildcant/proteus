import { formatPrice } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { PackageIcon } from 'lucide-react'
import type { StoreProductListItem } from '#/api/generated/model'

export function ProductCard({ product }: { product: StoreProductListItem }) {
  return (
    <Link to="/products/$productId" params={{ productId: product.id }} className="group block no-underline">
      <div className="aspect-[3/4] overflow-hidden bg-(--bg-subtle)">
        {product.thumbnail ? (
          <img
            src={product.thumbnail}
            alt={product.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-(--border)">
            <PackageIcon className="h-10 w-10" />
          </div>
        )}
      </div>
      <h3 className="mt-3 text-sm font-normal text-(--foreground)">{product.title}</h3>
      {!!product.startingPrice && (
        <p className="mt-1 text-sm font-semibold text-(--foreground)">
          {formatPrice(product.startingPrice.originalAmount, product.startingPrice.currencyCode)}
        </p>
      )}
    </Link>
  )
}
