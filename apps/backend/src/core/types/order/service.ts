import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type {
  ComputeOrderTotalsDTO,
  EnrichedOrderLineItemDTO,
  FilterableOrderAddressProps,
  FilterableOrderLineItemProps,
  FilterableOrderProps,
  FilterableOrderShippingMethodProps,
  FilterableOrderTransactionProps,
  OrderAddressDTO,
  OrderAddressType,
  OrderAllowedActions,
  OrderDTO,
  OrderFulfillmentStatus,
  OrderLineItemDTO,
  OrderShippingMethodDTO,
  OrderTotals,
  OrderTransactionDTO,
  PaymentStatus,
} from './common.js'
import type {
  CreateOrderAddressDTO,
  CreateOrderDTO,
  CreateOrderLineItemDTO,
  CreateOrderShippingMethodDTO,
  CreateOrderTransactionDTO,
  UpdateOrderAddressDTO,
  UpdateOrderDTO,
} from './mutations.js'

export type IOrderModuleService = {
  // Orders
  retrieveOrder(id: string, config?: FindConfig<OrderDTO>, context?: Context): Promise<OrderDTO>
  listOrders(filters?: FilterableOrderProps, config?: FindConfig<OrderDTO>, context?: Context): Promise<OrderDTO[]>
  listAndCountOrders(
    filters?: FilterableOrderProps,
    config?: FindConfig<OrderDTO>,
    context?: Context,
  ): Promise<[OrderDTO[], number]>
  createOrder(data: CreateOrderDTO, context?: Context): Promise<OrderDTO>
  createOrders(data: CreateOrderDTO[], context?: Context): Promise<OrderDTO[]>
  updateOrder(id: string, data: UpdateOrderDTO, context?: Context): Promise<OrderDTO>
  updateOrders(ids: string[], data: UpdateOrderDTO, context?: Context): Promise<OrderDTO[]>
  softDeleteOrders(ids: string[], context?: Context): Promise<void>
  restoreOrders(ids: string[], context?: Context): Promise<void>

  // Addresses — owned by the order, so every one of these is scoped to a parent
  retrieveOrderAddress(orderId: string, type: OrderAddressType, context?: Context): Promise<OrderAddressDTO | null>
  listOrderAddresses(
    filters?: FilterableOrderAddressProps,
    config?: FindConfig<OrderAddressDTO>,
    context?: Context,
  ): Promise<OrderAddressDTO[]>
  createOrderAddress(
    orderId: string,
    type: OrderAddressType,
    data: CreateOrderAddressDTO,
    context?: Context,
  ): Promise<OrderAddressDTO>
  updateOrderAddress(id: string, data: UpdateOrderAddressDTO, context?: Context): Promise<OrderAddressDTO>
  softDeleteOrderAddresses(ids: string[], context?: Context): Promise<void>

  // Line items
  createOrderLineItems(orderId: string, items: CreateOrderLineItemDTO[], context?: Context): Promise<OrderLineItemDTO[]>
  listOrderLineItems(
    filters?: FilterableOrderLineItemProps,
    config?: FindConfig<OrderLineItemDTO>,
    context?: Context,
  ): Promise<OrderLineItemDTO[]>

  // Shipping methods
  createOrderShippingMethods(
    orderId: string,
    methods: CreateOrderShippingMethodDTO[],
    context?: Context,
  ): Promise<OrderShippingMethodDTO[]>
  listOrderShippingMethods(
    filters?: FilterableOrderShippingMethodProps,
    config?: FindConfig<OrderShippingMethodDTO>,
    context?: Context,
  ): Promise<OrderShippingMethodDTO[]>

  // Transactions
  addOrderTransaction(data: CreateOrderTransactionDTO, context?: Context): Promise<OrderTransactionDTO>
  addOrderTransactions(data: CreateOrderTransactionDTO[], context?: Context): Promise<OrderTransactionDTO[]>
  listOrderTransactions(
    filters?: FilterableOrderTransactionProps,
    config?: FindConfig<OrderTransactionDTO>,
    context?: Context,
  ): Promise<OrderTransactionDTO[]>

  // Lifecycle
  completeOrder(id: string, context?: Context): Promise<OrderDTO>
  cancelOrder(id: string, context?: Context): Promise<OrderDTO>
  archiveOrder(id: string, context?: Context): Promise<OrderDTO>
  updateFulfillmentStatus(id: string, status: OrderFulfillmentStatus, context?: Context): Promise<OrderDTO>

  // Computed
  enrichLineItems(lineItems: OrderLineItemDTO[]): EnrichedOrderLineItemDTO[]
  computeOrderTotals(data: ComputeOrderTotalsDTO): OrderTotals

  // Computed status
  computePaymentStatus(totals: OrderTotals): PaymentStatus
  computeAllowedActions(order: OrderDTO): OrderAllowedActions
}
