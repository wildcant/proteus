import { BaseRepository } from '../../../core/utils/base-repository.js'
import { orderShippingMethodTable } from '../models/shipping-method.js'

export class OrderShippingMethodRepository extends BaseRepository(orderShippingMethodTable) {}
