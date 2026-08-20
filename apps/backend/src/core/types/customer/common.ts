import type { BaseFilterable, OperatorMap } from '../common.js'

export type CustomerDTO = {
  id: string
  hasAccount: boolean
  firstName: string | null
  lastName: string | null
  email: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableCustomerProps extends BaseFilterable<FilterableCustomerProps> {
  id?: string | string[] | undefined
  hasAccount?: boolean | undefined
  email?: string | string[] | OperatorMap<string> | undefined
  firstName?: string | OperatorMap<string> | undefined
  lastName?: string | OperatorMap<string> | undefined
  createdAt?: OperatorMap<Date> | undefined
  updatedAt?: OperatorMap<Date> | undefined
}

export interface FilterableCustomerAddressProps extends BaseFilterable<FilterableCustomerAddressProps> {
  id?: string | string[]
  customerId?: string | string[]
}

export type CustomerAddressDTO = {
  id: string
  customerId: string
  addressName: string | null
  isDefaultShipping: boolean
  isDefaultBilling: boolean
  company: string | null
  firstName: string | null
  lastName: string | null
  address1: string | null
  address2: string | null
  city: string | null
  countryCode: string | null
  province: string | null
  postalCode: string | null
  phone: string | null
  metadata: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}
