import type { BaseFilterable, OperatorMap } from '../common.js'

export type InviteDTO = {
  id: string
  email: string
  accepted: boolean
  token: string
  expiresAt: Date
  // TODO(RBAC): roles when RBAC is implemented
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableInviteProps extends BaseFilterable<FilterableInviteProps> {
  id?: string | string[] | undefined
  email?: string | string[] | OperatorMap<string> | undefined
  accepted?: boolean | undefined
  createdAt?: OperatorMap<Date> | undefined
  updatedAt?: OperatorMap<Date> | undefined
}
