import { BaseRepository } from '../../../core/utils/base-repository.js'
import { customerAddressTable } from '../models/customer-address.js'

export class CustomerAddressRepository extends BaseRepository(customerAddressTable) {}
