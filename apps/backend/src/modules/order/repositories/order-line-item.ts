import { BaseRepository } from '../../../core/utils/base-repository.js'
import { orderLineItemTable } from '../models/line-item.js'

export class OrderLineItemRepository extends BaseRepository(orderLineItemTable) {}
