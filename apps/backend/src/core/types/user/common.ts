import type { BaseFilterable, OperatorMap } from '../common.js'

export type UserDTO = {
  id: string
  email: string
  name: string
  locale: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableUserProps extends BaseFilterable<FilterableUserProps> {
  id?: string | string[] | undefined
  email?: string | string[] | OperatorMap<string> | undefined
  name?: string | OperatorMap<string> | undefined
  createdAt?: OperatorMap<Date> | undefined
  updatedAt?: OperatorMap<Date> | undefined
}
