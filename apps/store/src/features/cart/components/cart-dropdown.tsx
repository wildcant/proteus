import { formatPrice, Popover, PopoverContent, PopoverTrigger } from '@proteus/ui'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { ShoppingBagIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '#/components/button'
import { useCart } from '#/features/cart/api/cart'

export function CartDropdown() {
  const { cart } = useCart()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const previousCountRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHoveredRef = useRef(false)

  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0
  const isOnCartPage = location.pathname === '/cart'

  // Auto-open when item count increases (not on /cart page)
  useEffect(() => {
    if (previousCountRef.current > 0 && itemCount > previousCountRef.current && !isOnCartPage) {
      setOpen(true)
      timerRef.current = setTimeout(() => {
        if (!isHoveredRef.current) {
          setOpen(false)
        }
      }, 5000)
    }
    previousCountRef.current = itemCount
  }, [itemCount, isOnCartPage])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleOpenChange = (nextOpen: boolean) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    isHoveredRef.current = nextOpen
    setOpen(nextOpen)
  }

  const recentItems = cart?.items
    ? [...cart.items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)
    : []

  const subtotal = cart?.totals.itemsTotal ?? '0'
  const currencyCode = cart?.currencyCode ?? 'usd'

  return (
    <div className="flex items-center">
      {/* Mobile: direct link to /cart */}
      <Link
        to="/cart"
        aria-label="Cart"
        className="relative rounded-lg p-2 text-foreground no-underline hover:text-(--foreground-muted) sm:hidden"
      >
        <ShoppingBagIcon className="h-5 w-5" />
        {itemCount > 0 && <CartBadge count={itemCount} />}
      </Link>

      {/* Desktop: popover dropdown */}
      <div className="hidden sm:block">
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger
            openOnHover
            delay={0}
            closeDelay={300}
            className="relative cursor-pointer rounded-lg border-0 bg-transparent p-2 text-foreground hover:text-(--foreground-muted)"
            aria-label="Cart"
            onClick={() => navigate({ to: '/cart' })}
          >
            <ShoppingBagIcon className="h-5 w-5" />
            {itemCount > 0 && <CartBadge count={itemCount} />}
          </PopoverTrigger>

          <PopoverContent align="end" sideOffset={8} className="w-80">
            {recentItems.length === 0 ? (
              <div className="py-6 text-center">
                <p className="mb-2 font-medium text-foreground text-sm">Your cart is empty</p>
                <Link
                  to="/products"
                  className="text-(--foreground-muted) text-sm underline hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  Browse products
                </Link>
              </div>
            ) : (
              <>
                <ul className="m-0 list-none space-y-3 p-0">
                  {recentItems.map((item) => (
                    <li key={item.id} className="flex gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-(--bg-subtle)">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-(--foreground-muted)">
                            <ShoppingBagIcon className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="m-0 truncate font-medium text-foreground text-sm">{item.title}</p>
                        <p className="m-0 text-(--foreground-muted) text-xs">
                          Qty: {item.quantity} &middot; {formatPrice(item.unitPrice, currencyCode)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-center justify-between border-border border-t pt-3">
                  <span className="font-medium text-foreground text-sm">Subtotal</span>
                  <span className="font-semibold text-foreground text-sm">{formatPrice(subtotal, currencyCode)}</span>
                </div>

                <Button
                  render={<Link to="/cart" onClick={() => setOpen(false)} />}
                  variant="outline"
                  className="mt-3 w-full"
                >
                  Go to cart
                </Button>
              </>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

function CartBadge({ count }: { count: number }) {
  return (
    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 font-bold text-[10px] text-background leading-none">
      {count > 99 ? '99+' : String(count)}
    </span>
  )
}
