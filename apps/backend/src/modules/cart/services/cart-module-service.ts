import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type {
  CartAddressDTO,
  CartDTO,
  CartLineItemDTO,
  CartShippingMethodDTO,
  Context,
  CreateCartDTO,
  CreateLineItemDTO,
  CreateShippingMethodDTO,
  FilterableCartLineItemProps,
  FilterableCartProps,
  FilterableCartShippingMethodProps,
  FindConfig,
  ICartModuleService,
  UpdateCartDTO,
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

  async retrieveCartAddress(addressId: string, context?: Context): Promise<CartAddressDTO> {
    return this.cartAddressRepository.findByIdOrFail(addressId, undefined, context)
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

  async deleteCarts(cartIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.cartRepository.delete(cartIds, ctx)
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

      if (cart.status !== 'active') {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Cart ${cartId} is not active (current status: ${cart.status})`,
        })
      }

      const inputs = items.map((item) => ({ ...item, cartId }))
      return this.cartLineItemRepository.createMany(inputs, ctx)
    })
  }

  async updateLineItems(lineItemIds: string[], data: UpdateLineItemDTO, context?: Context): Promise<CartLineItemDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.cartLineItemRepository.updateMany(lineItemIds, data, ctx)
    })
  }

  async addLineItem(cartId: string, item: CreateLineItemDTO, context?: Context): Promise<CartLineItemDTO> {
    return this.withTransaction(context, async (ctx) => {
      const cart = await this.cartRepository.findByIdOrFail(cartId, undefined, ctx)

      if (cart.status !== 'active') {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Cart ${cartId} is not active (current status: ${cart.status})`,
        })
      }

      return this.cartLineItemRepository.create({ ...item, cartId }, ctx)
    })
  }

  async updateLineItem(lineItemId: string, data: UpdateLineItemDTO, context?: Context): Promise<CartLineItemDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.cartLineItemRepository.update(lineItemId, data, ctx)
    })
  }

  async deleteLineItems(lineItemIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.cartLineItemRepository.delete(lineItemIds, ctx)
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

      if (cart.status !== 'active') {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Cart ${cartId} is not active (current status: ${cart.status})`,
        })
      }

      const inputs = methods.map((method) => ({ ...method, cartId }))
      return this.cartShippingMethodRepository.createMany(inputs, ctx)
    })
  }

  async deleteShippingMethods(shippingMethodIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.cartShippingMethodRepository.delete(shippingMethodIds, ctx)
    })
  }

}
