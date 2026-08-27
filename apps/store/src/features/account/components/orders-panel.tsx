import { formatPrice, Skeleton } from '@proteus/ui'
import { formatDate } from '@proteus/utils'
import { Link } from '@tanstack/react-router'
import { ChevronRightIcon, PackageIcon } from 'lucide-react'
import { Suspense, useState } from 'react'
import type { StoreOrderListResponseOrdersItem } from '#/api/generated/model'
import { Button } from '#/components/button'
import { Pagination } from '#/components/pagination'
import { Panel } from '#/components/panel'
import { ORDERS_DEFAULT_OFFSET, ordersPageQuery, useSuspenseOrders } from '#/features/orders/api/orders'
import { fulfillmentLabels } from '#/features/orders/fulfillment-labels'

/**
 * The panel chrome renders straight away and only the list suspends, so paging does not blank
 * the heading — and, on first load, the greeting does not wait on the orders request.
 */
export function OrdersPanel({ className }: { className?: string }) {
  return (
    <Panel title="Orders" className={className}>
      <Suspense fallback={<OrdersFallback />}>
        <OrderList />
      </Suspense>
    </Panel>
  )
}

function OrderList() {
  const [offset, setOffset] = useState(ORDERS_DEFAULT_OFFSET)
  const { orders, count, limit } = useSuspenseOrders(ordersPageQuery(offset))

  if (count === 0) return <OrdersEmpty />

  return (
    <>
      <ul className="mt-6">
        {orders.map((order) => (
          <li key={order.id}>
            <OrderRow order={order} />
          </li>
        ))}
      </ul>
      <Pagination offset={offset} limit={limit} count={count} onOffsetChange={setOffset} className="mt-2" />
    </>
  )
}

function OrderRow({ order }: { order: StoreOrderListResponseOrdersItem }) {
  return (
    <Link
      to="/account/orders/$orderId"
      params={{ orderId: order.id }}
      className="flex items-center gap-4 border-line border-t py-4 first:border-t-0"
    >
      <OrderThumbnails items={order.items} />

      {/* Two lines on a phone — number and date, then status and total — rather than four
          columns squeezed into 360px. One line from lg. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="flex items-baseline gap-2 lg:flex-col lg:gap-0.5">
          <span className="font-bold text-ink">#{order.displayId}</span>
          <span className="text-ink-muted text-xs">{formatDate(order.createdAt)}</span>
        </div>
        <div className="flex items-baseline gap-2 lg:flex-col lg:items-end lg:gap-0.5">
          <span className="text-ink-muted text-xs">{fulfillmentLabels[order.fulfillmentStatus]}</span>
          <span className="font-semibold text-ink">{formatPrice(order.total, order.currencyCode)}</span>
        </div>
      </div>

      <ChevronRightIcon className="size-4 shrink-0 text-ink-muted" />
    </Link>
  )
}

/** At most three, then a count. Beyond that the strip is wider than the row it labels. */
function OrderThumbnails({ items }: { items: StoreOrderListResponseOrdersItem['items'] }) {
  const shown = items.slice(0, 3)
  const remaining = items.length - shown.length

  return (
    <div className="flex shrink-0 items-center gap-1">
      {shown.map((item) => (
        <div key={item.id} className="size-12 overflow-hidden bg-surface">
          {item.thumbnail ? (
            <img src={item.thumbnail} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-ink-subtle">
              <PackageIcon className="size-4" />
            </div>
          )}
        </div>
      ))}
      {remaining > 0 ? <span className="text-ink-muted text-xs">+{remaining}</span> : null}
    </div>
  )
}

function OrdersEmpty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
      <PackageIcon className="size-8 text-ink-subtle" strokeWidth={1.5} />
      <p className="mt-6 max-w-70 text-ink-muted text-sm">
        You haven't made any orders yet. When you make an order it'll show up here.
      </p>
      {/* One link, not the reference's gendered pair: there is no category taxonomy behind it. */}
      <Button render={<Link to="/" />} className="mt-8">
        Shop all products
      </Button>
    </div>
  )
}

function OrdersFallback() {
  return (
    <ul className="mt-6">
      {Array.from({ length: 3 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
        <li key={index} className="flex items-center gap-4 border-line border-t py-4 first:border-t-0">
          <Skeleton className="size-12 shrink-0" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </li>
      ))}
    </ul>
  )
}
