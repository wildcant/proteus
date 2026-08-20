import { BaseRepository } from '../../../core/utils/base-repository.js'
import { orderAddressTable } from '../models/address.js'

export class OrderAddressRepository extends BaseRepository(orderAddressTable) {}
