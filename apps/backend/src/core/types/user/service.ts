import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type { FilterableUserProps, UserDTO } from './common.js'
import type { FilterableInviteProps, InviteDTO } from './invite-common.js'
import type { CreateInviteDTO, UpdateInviteDTO } from './invite-mutations.js'
import type { CreateUserDTO, UpdateUserDTO } from './mutations.js'

export type IUserModuleService = {
  retrieveUser(userId: string, config?: FindConfig<UserDTO>, context?: Context): Promise<UserDTO>
  listUsers(filters?: FilterableUserProps, config?: FindConfig<UserDTO>, context?: Context): Promise<UserDTO[]>
  listAndCountUsers(
    filters?: FilterableUserProps,
    config?: FindConfig<UserDTO>,
    context?: Context,
  ): Promise<[UserDTO[], number]>
  createUsers(data: CreateUserDTO[], context?: Context): Promise<UserDTO[]>
  updateUsers(userIds: string[], data: UpdateUserDTO, context?: Context): Promise<UserDTO[]>
  createUser(data: CreateUserDTO, context?: Context): Promise<UserDTO>
  updateUser(userId: string, data: UpdateUserDTO, context?: Context): Promise<UserDTO>
  softDeleteUsers(userIds: string[], context?: Context): Promise<void>
  restoreUsers(userIds: string[], context?: Context): Promise<void>

  // Invites
  createInvites(data: CreateInviteDTO[], context?: Context): Promise<InviteDTO[]>
  retrieveInvite(inviteId: string, config?: FindConfig<InviteDTO>, context?: Context): Promise<InviteDTO>
  listInvites(filters?: FilterableInviteProps, config?: FindConfig<InviteDTO>, context?: Context): Promise<InviteDTO[]>
  listAndCountInvites(
    filters?: FilterableInviteProps,
    config?: FindConfig<InviteDTO>,
    context?: Context,
  ): Promise<[InviteDTO[], number]>
  updateInvites(inviteIds: string[], data: UpdateInviteDTO, context?: Context): Promise<InviteDTO[]>
  createInvite(data: CreateInviteDTO, context?: Context): Promise<InviteDTO>
  updateInvite(inviteId: string, data: UpdateInviteDTO, context?: Context): Promise<InviteDTO>
  softDeleteInvites(inviteIds: string[], context?: Context): Promise<void>
  restoreInvites(inviteIds: string[], context?: Context): Promise<void>
  validateInviteToken(token: string): Promise<InviteDTO>
  refreshInviteToken(inviteId: string, context?: Context): Promise<InviteDTO>
  refreshInviteTokens(inviteIds: string[], context?: Context): Promise<InviteDTO[]>
}
