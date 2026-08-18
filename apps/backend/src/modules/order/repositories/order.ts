import { BaseRepository } from '../../../core/utils/base-repository.js'
import { orderTable } from '../models/order.js'

export class OrderRepository extends BaseRepository(orderTable) {}
