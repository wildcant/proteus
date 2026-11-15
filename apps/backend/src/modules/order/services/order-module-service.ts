import { i18n } from '@proteus/utils'
import { BigNumber } from '../../../core/bignumber.js'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type { FindConfig } from '../../../core/types/common.js'
import type { Context } from '../../../core/types/context.js'
import type { Logger } from '../../../core/types/logger.js'
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
  OrderDTO,
  OrderLineItemDTO,
  OrderShippingMethodDTO,
  OrderTotals,
  OrderTransactionDTO,
} from '../../../core/types/order/common.js'
import type {
  CreateOrderAddressDTO,
  CreateOrderDTO,
  CreateOrderLineItemDTO,
  CreateOrderShippingMethodDTO,
  CreateOrderTransactionDTO,
  UpdateOrderDTO,
} from '../../../core/types/order/mutations.js'
import type { IOrderModuleService } from '../../../core/types/order/service.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { OrderRepository } from '../repositories/order.js'
import type { OrderAddressRepository } from '../repositories/order-address.js'
import type { OrderLineItemRepository } from '../repositories/order-line-item.js'
import type { OrderShippingMethodRepository } from '../repositories/order-shipping-method.js'
import type { OrderTransactionRepository } from '../repositories/order-transaction.js'

/** An address row on its way into the database: the caller's fields, plus the order that owns it. */
type OrderAddressInput = CreateOrderAddressDTO & { orderId: string; type: OrderAddressType }

type InjectedDependencies = {
  orderRepository: OrderRepository
  orderAddressRepository: OrderAddressRepository
  orderLineItemRepository: OrderLineItemRepository
  orderShippingMethodRepository: OrderShippingMethodRepository
  orderTransactionRepository: OrderTransactionRepository
  withTransaction: WithTransaction
  logger: Logger
}

export class OrderModuleService implements IOrderModuleService {
  private orderRepository: OrderRepository
  private orderAddressRepository: OrderAddressRepository
  private orderLineItemRepository: OrderLineItemRepository
  private orderShippingMethodRepository: OrderShippingMethodRepository
  private orderTransactionRepository: OrderTransactionRepository
  private withTransaction: WithTransaction
  private logger: Logger

  constructor({
    orderRepository,
    orderAddressRepository,
    orderLineItemRepository,
    orderShippingMethodRepository,
    orderTransactionRepository,
    withTransaction,
    logger,
  }: InjectedDependencies) {
    this.orderRepository = orderRepository
    this.orderAddressRepository = orderAddressRepository
    this.orderLineItemRepository = orderLineItemRepository
    this.orderShippingMethodRepository = orderShippingMethodRepository
    this.orderTransactionRepository = orderTransactionRepository
    this.withTransaction = withTransaction
    this.logger = logger
  }

  // ---------------------------------------------------------------------------
  // Orders
  // ---------------------------------------------------------------------------

  async retrieveOrder(id: string, config?: FindConfig<OrderDTO>, context?: Context): Promise<OrderDTO> {
    return this.orderRepository.findByIdOrFail(id, config, context)
  }

  async listOrders(
    filters?: FilterableOrderProps,
    config?: FindConfig<OrderDTO>,
    context?: Context,
  ): Promise<OrderDTO[]> {
    return this.orderRepository.find(filters, config, context)
  }

  async listAndCountOrders(
    filters?: FilterableOrderProps,
    config?: FindConfig<OrderDTO>,
    context?: Context,
  ): Promise<[OrderDTO[], number]> {
    return this.orderRepository.findAndCount(filters, config, context)
  }

  async createOrder(data: CreateOrderDTO, context?: Context): Promise<OrderDTO> {
    this.logger.debug('Creating order')
    return this.withTransaction(context, async (ctx) => {
      const order = await this.orderRepository.create(this.toOrderInput(data), ctx)

      const addressInputs = this.toAddressInputs(order.id, data)
      if (addressInputs.length) {
        await this.orderAddressRepository.createMany(addressInputs, ctx)
      }

      const lineItemInputs = (data.items ?? []).map((item) => ({ ...item, orderId: order.id }))
      if (lineItemInputs.length) {
        await this.orderLineItemRepository.createMany(lineItemInputs, ctx)
      }

      const shippingMethodInputs = (data.shippingMethods ?? []).map((method) => ({ ...method, orderId: order.id }))
      if (shippingMethodInputs.length) {
        await this.orderShippingMethodRepository.createMany(shippingMethodInputs, ctx)
      }

      return order
    })
  }

  async createOrders(data: CreateOrderDTO[], context?: Context): Promise<OrderDTO[]> {
    this.logger.debug(`Creating ${data.length} order(s)`)
    return this.withTransaction(context, async (ctx) => {
      const orders = await this.orderRepository.createMany(
        data.map((order) => this.toOrderInput(order)),
        ctx,
      )

      const addressInputs = orders.flatMap((order, i) => this.toAddressInputs(order.id, data[i]))
      if (addressInputs.length) {
        await this.orderAddressRepository.createMany(addressInputs, ctx)
      }

      const lineItemInputs = orders.flatMap((order, i) =>
        (data[i]?.items ?? []).map((item) => ({ ...item, orderId: order.id })),
      )
      if (lineItemInputs.length) {
        await this.orderLineItemRepository.createMany(lineItemInputs, ctx)
      }

      const shippingMethodInputs = orders.flatMap((order, i) =>
        (data[i]?.shippingMethods ?? []).map((method) => ({ ...method, orderId: order.id })),
      )
      if (shippingMethodInputs.length) {
        await this.orderShippingMethodRepository.createMany(shippingMethodInputs, ctx)
      }

      return orders
    })
  }

  async updateOrder(id: string, data: UpdateOrderDTO, context?: Context): Promise<OrderDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.orderRepository.update(id, data, ctx)
    })
  }

  async updateOrders(ids: string[], data: UpdateOrderDTO, context?: Context): Promise<OrderDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.orderRepository.updateMany(ids, data, ctx)
    })
  }

  async findOrderIdByDisplayIdAndPhoneDigits(
    displayId: number,
    phoneLastDigits: string,
    context?: Context,
  ): Promise<string | null> {
    return this.orderRepository.findIdByDisplayIdAndPhoneDigits(displayId, phoneLastDigits, context)
  }

  async softDeleteOrders(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.orderRepository.softDelete(ids, ctx)
    })
  }

  async restoreOrders(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.orderRepository.restore(ids, ctx)
    })
  }

  // ---------------------------------------------------------------------------
  // Addresses
  // ---------------------------------------------------------------------------

  /** Null rather than a throw: an order legitimately has no billing address, or none at all. */
  async retrieveOrderAddress(
    orderId: string,
    type: OrderAddressType,
    context?: Context,
  ): Promise<OrderAddressDTO | null> {
    return this.orderAddressRepository.findOne({ orderId, type }, undefined, context)
  }

  async listOrderAddresses(
    filters?: FilterableOrderAddressProps,
    config?: FindConfig<OrderAddressDTO>,
    context?: Context,
  ): Promise<OrderAddressDTO[]> {
    return this.orderAddressRepository.find(filters, config, context)
  }

  async createOrderAddress(
    orderId: string,
    type: OrderAddressType,
    data: CreateOrderAddressDTO,
    context?: Context,
  ): Promise<OrderAddressDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.orderAddressRepository.create({ ...data, orderId, type }, ctx)
    })
  }

  async softDeleteOrderAddresses(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.orderAddressRepository.softDelete(ids, ctx)
    })
  }

  // ---------------------------------------------------------------------------
  // Line items
  // ---------------------------------------------------------------------------

  async createOrderLineItems(
    orderId: string,
    items: CreateOrderLineItemDTO[],
    context?: Context,
  ): Promise<OrderLineItemDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      await this.orderRepository.findByIdOrFail(orderId, undefined, ctx)
      const inputs = items.map((item) => ({ ...item, orderId }))
      return this.orderLineItemRepository.createMany(inputs, ctx)
    })
  }

  async listOrderLineItems(
    filters?: FilterableOrderLineItemProps,
    config?: FindConfig<OrderLineItemDTO>,
    context?: Context,
  ): Promise<OrderLineItemDTO[]> {
    return this.orderLineItemRepository.find(filters, config, context)
  }

  // ---------------------------------------------------------------------------
  // Shipping methods
  // ---------------------------------------------------------------------------

  async createOrderShippingMethods(
    orderId: string,
    methods: CreateOrderShippingMethodDTO[],
    context?: Context,
  ): Promise<OrderShippingMethodDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      await this.orderRepository.findByIdOrFail(orderId, undefined, ctx)
      const inputs = methods.map((method) => ({ ...method, orderId }))
      return this.orderShippingMethodRepository.createMany(inputs, ctx)
    })
  }

  async listOrderShippingMethods(
    filters?: FilterableOrderShippingMethodProps,
    config?: FindConfig<OrderShippingMethodDTO>,
    context?: Context,
  ): Promise<OrderShippingMethodDTO[]> {
    return this.orderShippingMethodRepository.find(filters, config, context)
  }

  // ---------------------------------------------------------------------------
  // Transactions
  // ---------------------------------------------------------------------------

  async addOrderTransaction(data: CreateOrderTransactionDTO, context?: Context): Promise<OrderTransactionDTO> {
    return this.withTransaction(context, async (ctx) => {
      await this.orderRepository.findByIdOrFail(data.orderId, undefined, ctx)
      const [transaction] = await this.addOrderTransactions([data], ctx)
      if (!transaction) {
        throw new AppError({ type: ErrorTypes.UNEXPECTED_STATE, message: i18n.t('Expected row to be created') })
      }
      return transaction
    })
  }

  /**
   * Writes what is new and answers with what was already there for the rest. A transaction records
   * one capture or one refund, keyed by that row (`reference`, `referenceId`), and the step writing
   * it may run again after it committed — so the second write converges on the first instead of
   * doubling the Order's Paid Total.
   */
  async addOrderTransactions(data: CreateOrderTransactionDTO[], context?: Context): Promise<OrderTransactionDTO[]> {
    if (data.length === 0) return []
    return this.withTransaction(context, async (ctx) => {
      const inserted = await this.orderTransactionRepository.createManyIgnoringDuplicates(data, ctx)

      const sameKey = (a: CreateOrderTransactionDTO | OrderTransactionDTO, b: CreateOrderTransactionDTO) =>
        a.reference === b.reference && a.referenceId === b.referenceId
      const skipped = data.filter((d) => d.referenceId != null && !inserted.some((row) => sameKey(row, d)))
      if (skipped.length === 0) return inserted

      const existing = await this.orderTransactionRepository.find(
        { referenceId: skipped.map((d) => d.referenceId).filter((id) => id != null) },
        undefined,
        ctx,
      )
      return [...inserted, ...existing.filter((row) => skipped.some((d) => sameKey(row, d)))]
    })
  }

  async softDeleteOrderTransactions(ids: string[], context?: Context): Promise<void> {
    if (ids.length === 0) return
    return this.withTransaction(context, async (ctx) => {
      await this.orderTransactionRepository.softDelete(ids, ctx)
    })
  }

  async listOrderTransactions(
    filters?: FilterableOrderTransactionProps,
    config?: FindConfig<OrderTransactionDTO>,
    context?: Context,
  ): Promise<OrderTransactionDTO[]> {
    return this.orderTransactionRepository.find(filters, config, context)
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async completeOrder(id: string, context?: Context): Promise<OrderDTO> {
    return this.withTransaction(context, async (ctx) => {
      const order = await this.orderRepository.findByIdOrFail(id, undefined, ctx)

      if (order.status !== 'pending') {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: i18n.t('Cannot complete order {id}: status is "{status}", expected "pending"'),
          values: { id, status: order.status },
        })
      }

      return this.orderRepository.update(id, { status: 'completed' }, ctx)
    })
  }

  async cancelOrder(id: string, context?: Context): Promise<OrderDTO> {
    return this.withTransaction(context, async (ctx) => {
      const order = await this.orderRepository.findByIdOrFail(id, undefined, ctx)

      if (order.status !== 'pending' && order.status !== 'draft') {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: i18n.t('Cannot cancel order {id}: status is "{status}", expected "pending" or "draft"'),
          values: { id, status: order.status },
        })
      }

      return this.orderRepository.update(id, { status: 'canceled', canceledAt: new Date() }, ctx)
    })
  }

  async archiveOrder(id: string, context?: Context): Promise<OrderDTO> {
    return this.withTransaction(context, async (ctx) => {
      const order = await this.orderRepository.findByIdOrFail(id, undefined, ctx)

      if (order.status !== 'completed') {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: i18n.t('Cannot archive order {id}: status is "{status}", expected "completed"'),
          values: { id, status: order.status },
        })
      }

      return this.orderRepository.update(id, { status: 'archived' }, ctx)
    })
  }

  enrichLineItems(lineItems: OrderLineItemDTO[]): EnrichedOrderLineItemDTO[] {
    return lineItems.map((item) => ({
      ...item,
      lineTotal: item.unitPrice.multipliedBy(item.quantity),
    }))
  }

  // ---------------------------------------------------------------------------
  // Computed totals
  // ---------------------------------------------------------------------------

  computeOrderTotals({ lineItems, shippingMethods, transactions }: ComputeOrderTotalsDTO): OrderTotals {
    const itemsTotal = lineItems.reduce(
      (sum, item) => sum.plus(item.unitPrice.multipliedBy(item.quantity)),
      new BigNumber(0),
    )

    const shippingTotal = shippingMethods.reduce((sum, method) => sum.plus(method.amount), new BigNumber(0))

    const orderTotal = itemsTotal.plus(shippingTotal)

    const paidTotal = transactions.reduce((sum, transaction) => sum.plus(transaction.amount), new BigNumber(0))

    const outstandingTotal = orderTotal.minus(paidTotal)

    return { itemsTotal, shippingTotal, orderTotal, paidTotal, outstandingTotal }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** The order row of a creation payload. A draft is created as a Draft Order, and stays one until converted. */
  private toOrderInput(data: CreateOrderDTO): CreateOrderDTO & { isDraftOrder: boolean } {
    return { ...data, isDraftOrder: data.status === 'draft' }
  }

  /** The two nested addresses of a creation payload, as rows the order already owns. */
  private toAddressInputs(orderId: string, data: CreateOrderDTO | undefined): OrderAddressInput[] {
    const inputs: OrderAddressInput[] = []

    if (data?.shippingAddress) inputs.push({ ...data.shippingAddress, orderId, type: 'shipping' })
    if (data?.billingAddress) inputs.push({ ...data.billingAddress, orderId, type: 'billing' })

    return inputs
  }
}
