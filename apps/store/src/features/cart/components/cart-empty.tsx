import { ShoppingBagIcon } from 'lucide-react'
import { ButtonLink } from '#/components/button'

/**
 * The panel's empty state. The link needs no `onClick`: a plain `<Link>` drops the search params,
 * and `modal` is one of them, so navigating away is closing the panel.
 */
export function CartEmpty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center lg:px-6">
      <ShoppingBagIcon className="mb-4 h-10 w-10 text-ink-subtle" />
      <h2 className="type-heading m-0 text-ink">Your bag is empty</h2>
      <p className="m-0 mt-2 mb-6 text-ink-muted text-sm">There are no products in your bag</p>
      <ButtonLink to="/" className="w-full">
        Browse products
      </ButtonLink>
    </div>
  )
}
