import { Button, Card, CardAction, CardHeader, CardTitle, StatusBadge, usePrompt } from '@proteus/ui'
import { PackageCheckIcon, PackageIcon, TruckIcon } from 'lucide-react'
import type { AdminOrderResponseOrder } from '#/api/generated/model'
import {
  useCreateFulfillment,
  useCreateShipment,
  useFulfillmentProviders,
  useMarkAsDelivered,
} from '#/features/orders/api/orders'
import { fulfillmentStatusColors } from '#/features/orders/utils/order-status'

export function OrderFulfillmentSection({ order }: { order: AdminOrderResponseOrder }) {
  const shippableItems = order.lineItems.filter((item) => item.requiresShipping)

  if (shippableItems.length === 0) return null

  const fulfillment = order.fulfillments[0]

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>Fulfillment</CardTitle>
        <CardAction className="flex items-center gap-x-3">
          <StatusBadge color={fulfillmentStatusColors[order.fulfillmentStatus]}>{order.fulfillmentStatus}</StatusBadge>
          {order.allowedActions.canFulfill ? <FulfillAction order={order} shippableItems={shippableItems} /> : null}
          {order.allowedActions.canShip && fulfillment ? (
            <ShipAction orderId={order.id} fulfillmentId={fulfillment.id} />
          ) : null}
          {order.allowedActions.canMarkAsDelivered && fulfillment ? (
            <DeliverAction orderId={order.id} fulfillmentId={fulfillment.id} />
          ) : null}
        </CardAction>
      </CardHeader>

      {shippableItems.map((item) => (
        <div key={item.id} className="flex items-center gap-4 px-6 py-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground text-xs">
            {item.title.charAt(0).toUpperCase()}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium text-sm">{item.title}</span>
            {!!item.variantTitle && <span className="text-muted-foreground text-xs">{item.variantTitle}</span>}
          </div>
          <span className="text-muted-foreground text-sm">&times;{item.quantity}</span>
        </div>
      ))}
    </Card>
  )
}

function FulfillAction({
  order,
  shippableItems,
}: {
  order: AdminOrderResponseOrder
  shippableItems: AdminOrderResponseOrder['lineItems']
}) {
  const { mutateAsync: fulfill, isPending } = useCreateFulfillment(order.id)
  const { data: providers } = useFulfillmentProviders()
  const prompt = usePrompt()

  const handleFulfill = async () => {
    const provider = providers?.fulfillmentProviders.find((p) => p.isEnabled)
    if (!provider) return

    const confirmed = await prompt({
      title: 'Fulfill order',
      description: `Mark all ${shippableItems.length} item(s) as fulfilled? This will adjust inventory.`,
      confirmText: 'Fulfill',
    })
    if (!confirmed) return

    const addr = order.shippingAddress
    const address = addr
      ? {
          company: addr.company ?? undefined,
          firstName: addr.firstName ?? undefined,
          lastName: addr.lastName ?? undefined,
          address1: addr.address1 ?? undefined,
          address2: addr.address2 ?? undefined,
          city: addr.city ?? undefined,
          countryCode: addr.countryCode ?? undefined,
          province: addr.province ?? undefined,
          postalCode: addr.postalCode ?? undefined,
          phone: addr.phone ?? undefined,
        }
      : {}

    await fulfill({
      providerId: provider.id,
      items: shippableItems.map((item) => ({
        title: item.title,
        quantity: item.quantity,
        lineItemId: item.id,
        ...(item.variantSku ? { sku: item.variantSku } : {}),
      })),
      address,
    })
  }

  return (
    <Button size="sm" variant="secondary" onClick={handleFulfill} disabled={isPending}>
      <PackageIcon className="size-4" />
      Fulfill
    </Button>
  )
}

function ShipAction({ orderId, fulfillmentId }: { orderId: string; fulfillmentId: string }) {
  const { mutateAsync: ship, isPending } = useCreateShipment(orderId, fulfillmentId)
  const prompt = usePrompt()

  const handleShip = async () => {
    const confirmed = await prompt({
      title: 'Mark as shipped',
      description: 'Mark this fulfillment as shipped?',
      confirmText: 'Mark as shipped',
    })
    if (!confirmed) return

    await ship({})
  }

  return (
    <Button size="sm" variant="secondary" onClick={handleShip} disabled={isPending}>
      <TruckIcon className="size-4" />
      Ship
    </Button>
  )
}

function DeliverAction({ orderId, fulfillmentId }: { orderId: string; fulfillmentId: string }) {
  const { mutateAsync: deliver, isPending } = useMarkAsDelivered(orderId, fulfillmentId)
  const prompt = usePrompt()

  const handleDeliver = async () => {
    const confirmed = await prompt({
      title: 'Mark as delivered',
      description: 'Mark this fulfillment as delivered?',
      confirmText: 'Mark as delivered',
    })
    if (!confirmed) return

    await deliver()
  }

  return (
    <Button size="sm" variant="secondary" onClick={handleDeliver} disabled={isPending}>
      <PackageCheckIcon className="size-4" />
      Delivered
    </Button>
  )
}
