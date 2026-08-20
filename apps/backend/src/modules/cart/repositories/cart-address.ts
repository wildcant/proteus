import { BaseRepository } from '../../../core/utils/base-repository.js'
import { cartAddressTable } from '../models/address.js'

export class CartAddressRepository extends BaseRepository(cartAddressTable) {}
