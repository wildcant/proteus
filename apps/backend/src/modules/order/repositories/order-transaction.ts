import { BaseRepository } from '../../../core/utils/base-repository.js'
import { orderTransactionTable } from '../models/transaction.js'

export class OrderTransactionRepository extends BaseRepository(orderTransactionTable) {}
