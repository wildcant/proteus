import { useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Suspense, useState } from 'react'
import { Pagination } from '#/components/store/pagination/pagination'
import { Panel } from '#/components/store/panel/panel'
import { ORDERS_DEFAULT_OFFSET, ordersPageQuery, useSuspenseOrders } from '#/entities/order/api/orders'
import { OrderRow } from '#/features/account/components/order-row/order-row'
import { OrdersEmpty } from '#/features/account/components/orders-empty/orders-empty'
import { OrdersFallback } from '#/features/account/components/orders-fallback/orders-fallback'
import {
  ordersPanel,
  ordersPanelOrder,
  ordersPanelOrders,
  ordersPanelPanel,
} from '#/features/account/components/orders-panel/orders-panel.variants'

/**
 * The panel chrome renders straight away and only the list suspends, so paging does not blank
 * the heading — and, on first load, the greeting does not wait on the orders request.
 */
export function OrdersPanel({ className }: { className?: string }) {
  const { t } = useLingui()
  return (
    <Panel title={t`Orders`} className={cn(ordersPanel(), ordersPanelPanel(), className)}>
      <Suspense fallback={<OrdersFallback />}>
        <OrderList />
      </Suspense>
    </Panel>
  )
}

function OrderList() {
  const [offset, setOffset] = useState(ORDERS_DEFAULT_OFFSET)
  const { orders, count, limit } = useSuspenseOrders(ordersPageQuery(offset))

  // `flex-1` fills the panel's body so the empty state centres in the tall lg panel: OrdersPanel
  // draws only the list, so no layer carries the empty state's fill.
  if (count === 0) return <OrdersEmpty className="flex-1" />

  return (
    <>
      <ul className={ordersPanelOrders()}>
        {orders.map((order) => (
          <li key={order.id}>
            <OrderRow order={order} className={ordersPanelOrder()} />
          </li>
        ))}
      </ul>
      {/* Not drawn: one page of orders in the seed. */}
      <Pagination offset={offset} limit={limit} count={count} onOffsetChange={setOffset} className="mt-2" />
    </>
  )
}
