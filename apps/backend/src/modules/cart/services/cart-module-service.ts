import { BigNumber } from '../../../core/bignumber.js'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type {
  CartAddressDTO,
  CartAddressType,
  CartDTO,
  CartLineItemDTO,
  CartLineItemPlanDTO,
  CartShippingMethodDTO,
  CartTotalsDTO,
  ComputeCartTotalsDTO,
  Context,
  CreateCartAddressDTO,
  CreateCartDTO,
  CreateLineItemDTO,
  CreateShippingMethodDTO,
  EnrichedCartLineItemDTO,
  FilterableCartAddressProps,
  FilterableCartLineItemProps,
  FilterableCartProps,
  FilterableCartShippingMethodProps,
  FindConfig,
  ICartModuleService,
  UpdateCartDTO,
  UpdateCartWithAddressesDTO,
  UpdateLineItemDTO,
} from '../../../core/types/index.js'
import type { Logger } from '../../../core/types/logger.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { CartRepository } from '../repositories/cart.js'
import type { CartAddressRepository } from '../repositories/cart-address.js'
import type { CartLineItemRepository } from '../repositories/cart-line-item.js'
import type { CartShippingMethodRepository } from '../repositories/cart-shipping-method.js'

type InjectedDependencies = {
  cartRepository: CartRepository
  cartAddressRepository: CartAddressRepository
  cartLineItemRepository: CartLineItemRepository
  cartShippingMethodRepository: CartShippingMethodRepository
  withTransaction: WithTransaction
  logger: Logger
}

export class CartModuleService implements ICartModuleService {
  private cartRepository: CartRepository
  private cartAddressRepository: CartAddressRepository
  private cartLineItemRepository: CartLineItemRepository
  private cartShippingMethodRepository: CartShippingMethodRepository
  private withTransaction: WithTransaction
  private logger: Logger

  constructor({
    cartRepository,
    cartAddressRepository,
    cartLineItemRepository,
    cartShippingMethodRepository,
    withTransaction,
    logger,
  }: InjectedDependencies) {
    this.cartRepository = cartRepository
    this.cartAddressRepository = cartAddressRepository
    this.cartLineItemRepository = cartLineItemRepository
    this.cartShippingMethodRepository = cartShippingMethodRepository
    this.withTransaction = withTransaction
    this.logger = logger
  }

  async retrieveCart(cartId: string, config?: FindConfig<CartDTO>, context?: Context): Promise<CartDTO> {
    return this.cartRepository.findByIdOrFail(cartId, config, context)
  }

  async listCarts(filters?: FilterableCartProps, config?: FindConfig<CartDTO>, context?: Context): Promise<CartDTO[]> {
    return this.cartRepository.find(filters, config, context)
  }

  async listAndCountCarts(
    filters?: FilterableCartProps,
    config?: FindConfig<CartDTO>,
    context?: Context,
  ): Promise<[CartDTO[], number]> {
    return this.cartRepository.findAndCount(filters, config, context)
  }

  async createCarts(data: CreateCartDTO[], context?: Context): Promise<CartDTO[]> {
    this.logger.debug(`Creating ${data.length} cart(s)`)
    return this.withTransaction(context, async (ctx) => {
      const carts = await this.cartRepository.createMany(data, ctx)

      const lineItemInputs = carts.flatMap((cart, i) =>
        (data[i]?.items ?? []).map((item) => ({ ...item, cartId: cart.id })),
      )

      if (lineItemInputs.length) {
        await this.cartLineItemRepository.createMany(lineItemInputs, ctx)
      }

      return carts
    })
  }

  async updateCarts(cartIds: string[], data: UpdateCartDTO, context?: Context): Promise<CartDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.cartRepository.updateMany(cartIds, data, ctx)
    })
  }

  async createCart(data: CreateCartDTO, context?: Context): Promise<CartDTO> {
    return this.withTransaction(context, async (ctx) => {
      const cart = await this.cartRepository.create(data, ctx)

      const lineItemInputs = (data.items ?? []).map((item) => ({ ...item, cartId: cart.id }))
      if (lineItemInputs.length) {
        await this.cartLineItemRepository.createMany(lineItemInputs, ctx)
      }

      return cart
    })
  }

  async updateCart(cartId: string, data: UpdateCartDTO, context?: Context): Promise<CartDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.cartRepository.update(cartId, data, ctx)
    })
  }

  async updateCartWithAddresses(cartId: string, data: UpdateCartWithAddressesDTO, context?: Context): Promise<CartDTO> {
    return this.withTransaction(context, async (ctx) => {
      const cart = await this.cartRepository.findByIdOrFail(cartId, undefined, ctx)

      const updateData: UpdateCartDTO = {}

      if (data.customerId !== undefined) {
        updateData.customerId = data.customerId
      }

      if (data.email !== undefined) {
        updateData.email = data.email
      }

      if (data.shippingAddress) {
        await this.upsertCartAddress(cartId, 'shipping', data.shippingAddress, ctx)
      }

      if (data.billingAddress) {
        await this.upsertCartAddress(cartId, 'billing', data.billingAddress, ctx)
      }

      // The addresses are rows of their own now, so the cart itself only changes when the
      // payload names a cart column.
      if (Object.keys(updateData).length === 0) {
        return cart
      }

      return this.cartRepository.update(cartId, updateData, ctx)
    })
  }

  async softDeleteCarts(cartIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.cartRepository.softDelete(cartIds, ctx)
    })
  }

  async restoreCarts(cartIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.cartRepository.restore(cartIds, ctx)
    })
  }

  async listLineItems(
    filters?: FilterableCartLineItemProps,
    config?: FindConfig<CartLineItemDTO>,
    context?: Context,
  ): Promise<CartLineItemDTO[]> {
    return this.cartLineItemRepository.find(filters, config, context)
  }

  async addLineItems(cartId: string, items: CreateLineItemDTO[], context?: Context): Promise<CartLineItemDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      const cart = await this.cartRepository.findByIdOrFail(cartId, undefined, ctx)
      this.assertNotCompleted(cart)

      const inputs = items.map((item) => ({ ...item, cartId }))
      return this.cartLineItemRepository.createMany(inputs, ctx)
    })
  }

  async updateLineItems(lineItemIds: string[], data: UpdateLineItemDTO, context?: Context): Promise<CartLineItemDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.cartLineItemRepository.updateMany(lineItemIds, data, ctx)
    })
  }

  async applyLineItemPlan(cartId: string, plan: CartLineItemPlanDTO, context?: Context): Promise<CartLineItemDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      const cart = await this.cartRepository.findByIdOrFail(cartId, undefined, ctx)
      this.assertNotCompleted(cart)

      const created = await this.cartLineItemRepository.createMany(
        plan.create.map((item) => ({ ...item, cartId })),
        ctx,
      )
      const merged = await Promise.all(
        plan.merge.map((update) => this.cartLineItemRepository.update(update.id, update.data, ctx)),
      )

      return [...created, ...merged]
    })
  }

  async addLineItem(cartId: string, item: CreateLineItemDTO, context?: Context): Promise<CartLineItemDTO> {
    return this.withTransaction(context, async (ctx) => {
      const cart = await this.cartRepository.findByIdOrFail(cartId, undefined, ctx)
      this.assertNotCompleted(cart)

      return this.cartLineItemRepository.create({ ...item, cartId }, ctx)
    })
  }

  async updateLineItem(lineItemId: string, data: UpdateLineItemDTO, context?: Context): Promise<CartLineItemDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.cartLineItemRepository.update(lineItemId, data, ctx)
    })
  }

  async softDeleteLineItems(lineItemIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.cartLineItemRepository.softDelete(lineItemIds, ctx)
    })
  }

  async listShippingMethods(
    filters?: FilterableCartShippingMethodProps,
    config?: FindConfig<CartShippingMethodDTO>,
    context?: Context,
  ): Promise<CartShippingMethodDTO[]> {
    return this.cartShippingMethodRepository.find(filters, config, context)
  }

  async addShippingMethods(
    cartId: string,
    methods: CreateShippingMethodDTO[],
    context?: Context,
  ): Promise<CartShippingMethodDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      const cart = await this.cartRepository.findByIdOrFail(cartId, undefined, ctx)
      this.assertNotCompleted(cart)

      const inputs = methods.map((method) => ({ ...method, cartId }))
      return this.cartShippingMethodRepository.createMany(inputs, ctx)
    })
  }

  async softDeleteShippingMethods(shippingMethodIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.cartShippingMethodRepository.softDelete(shippingMethodIds, ctx)
    })
  }

  /**
   * Makes `method` the cart's only shipping method, replacing whatever it had.
   *
   * Replace rather than add, because the delivery step offers one choice: a shopper picking a
   * second option is changing their mind about the first, not buying two deliveries.
   *
   * Hiding the old rows and writing the new one are one transaction. They are rows of one table
   * in one module, so the database is what makes the pair atomic — a failure part-way leaves the
   * cart with the method it already had rather than with none, and the caller needs no
   * compensation to get that. A cart stripped of its delivery by a half-applied change would
   * price the order short at exactly the moment the shopper is trying to pay.
   */
  async setShippingMethod(
    cartId: string,
    method: CreateShippingMethodDTO,
    context?: Context,
  ): Promise<CartShippingMethodDTO> {
    return this.withTransaction(context, async (ctx) => {
      const existing = await this.listShippingMethods({ cartId }, undefined, ctx)
      if (existing.length > 0) {
        await this.softDeleteShippingMethods(
          existing.map((shippingMethod) => shippingMethod.id),
          ctx,
        )
      }

      // `addShippingMethods` is what refuses a completed cart, so the guard covers this path too.
      const [added] = await this.addShippingMethods(cartId, [method], ctx)
      if (!added) {
        throw new AppError({
          type: ErrorTypes.UNEXPECTED_STATE,
          message: 'Shipping method not returned after create',
        })
      }

      return added
    })
  }

  async restoreShippingMethods(shippingMethodIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.cartShippingMethodRepository.restore(shippingMethodIds, ctx)
    })
  }

  async listCartAddresses(
    filters?: FilterableCartAddressProps,
    config?: FindConfig<CartAddressDTO>,
    context?: Context,
  ): Promise<CartAddressDTO[]> {
    return this.cartAddressRepository.find(filters, config, context)
  }

  /** Replaces the cart's address of one type, which the partial unique index allows at most
   *  one of — so an existing row is rewritten rather than duplicated. */
  async upsertCartAddress(
    cartId: string,
    type: CartAddressType,
    data: CreateCartAddressDTO,
    context?: Context,
  ): Promise<CartAddressDTO> {
    return this.withTransaction(context, async (ctx) => {
      const existing = await this.cartAddressRepository.findOne({ cartId, type }, undefined, ctx)
      if (existing) {
        return this.cartAddressRepository.update(existing.id, data, ctx)
      }
      return this.cartAddressRepository.create({ ...data, cartId, type }, ctx)
    })
  }

  async softDeleteCartAddresses(addressIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.cartAddressRepository.softDelete(addressIds, ctx)
    })
  }

  async restoreCartAddresses(addressIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.cartAddressRepository.restore(addressIds, ctx)
    })
  }

  enrichLineItem(lineItem: CartLineItemDTO): EnrichedCartLineItemDTO {
    return { ...lineItem, lineTotal: lineItem.unitPrice.multipliedBy(lineItem.quantity) }
  }

  enrichLineItems(lineItems: CartLineItemDTO[]): EnrichedCartLineItemDTO[] {
    return lineItems.map((item) => this.enrichLineItem(item))
  }

  computeCartTotals({ lineItems, shippingMethods }: ComputeCartTotalsDTO): CartTotalsDTO {
    const itemsTotal = lineItems.reduce(
      (sum, item) => sum.plus(item.unitPrice.multipliedBy(item.quantity)),
      new BigNumber(0),
    )

    const shippingTotal = shippingMethods.reduce((sum, method) => sum.plus(method.amount), new BigNumber(0))

    const cartTotal = itemsTotal.plus(shippingTotal)

    return { itemsTotal, shippingTotal, cartTotal }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  /** A completed cart is the record behind an order, so nothing may be added to it. */
  private assertNotCompleted(cart: CartDTO): void {
    if (!cart.completedAt) return

    throw new AppError({
      type: ErrorTypes.NOT_ALLOWED,
      message: `Cart ${cart.id} is already completed`,
    })
  }
}
