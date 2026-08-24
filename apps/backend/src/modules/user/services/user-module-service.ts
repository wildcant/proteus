import jwt from 'jsonwebtoken'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type {
  Context,
  CreateInviteDTO,
  CreateUserDTO,
  FilterableInviteProps,
  FilterableUserProps,
  FindConfig,
  InviteDTO,
  IUserModuleService,
  UpdateInviteDTO,
  UpdateUserDTO,
  UserDTO,
} from '../../../core/types/index.js'
import type { Logger } from '../../../core/types/logger.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import { env } from '../../../env.js'
import type { InviteRepository } from '../repositories/invite.js'
import type { UserRepository } from '../repositories/user.js'

const INVITE_EXPIRY_HOURS = 24

type InjectedDependencies = {
  inviteRepository: InviteRepository
  userRepository: UserRepository
  withTransaction: WithTransaction
  logger: Logger
}

type InviteTokenPayload = {
  email: string
  purpose: 'invite'
}

export class UserModuleService implements IUserModuleService {
  private inviteRepository: InviteRepository
  private userRepository: UserRepository
  private withTransaction: WithTransaction
  private logger: Logger

  constructor({ inviteRepository, userRepository, withTransaction, logger }: InjectedDependencies) {
    this.inviteRepository = inviteRepository
    this.userRepository = userRepository
    this.withTransaction = withTransaction
    this.logger = logger
  }

  // ---- Users ----

  async retrieveUser(userId: string, config?: FindConfig<UserDTO>, context?: Context): Promise<UserDTO> {
    return this.userRepository.findByIdOrFail(userId, config, context)
  }

  async listUsers(filters?: FilterableUserProps, config?: FindConfig<UserDTO>, context?: Context): Promise<UserDTO[]> {
    return this.userRepository.find(filters, config, context)
  }

  async listAndCountUsers(
    filters?: FilterableUserProps,
    config?: FindConfig<UserDTO>,
    context?: Context,
  ): Promise<[UserDTO[], number]> {
    const [rows, count] = await this.userRepository.findAndCount(filters, config, context)
    return [rows, count]
  }

  async createUsers(data: CreateUserDTO[], context?: Context): Promise<UserDTO[]> {
    this.logger.debug(`Creating ${data.length} user(s)`)
    return this.withTransaction(context, async (ctx) => {
      return this.userRepository.createMany(data, ctx)
    })
  }

  async updateUsers(userIds: string[], data: UpdateUserDTO, context?: Context): Promise<UserDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.userRepository.updateMany(userIds, data, ctx)
    })
  }

  async createUser(data: CreateUserDTO, context?: Context): Promise<UserDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.userRepository.create(data, ctx)
    })
  }

  async updateUser(userId: string, data: UpdateUserDTO, context?: Context): Promise<UserDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.userRepository.update(userId, data, ctx)
    })
  }

  async softDeleteUsers(userIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.userRepository.softDelete(userIds, ctx)
    })
  }

  async restoreUsers(userIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.userRepository.restore(userIds, ctx)
    })
  }

  // ---- Invites ----

  async createInvites(data: CreateInviteDTO[], context?: Context): Promise<InviteDTO[]> {
    this.logger.debug(`Creating ${data.length} invite(s)`)

    const emails = data.map((d) => d.email)
    const existingUsers = await this.userRepository.find({ email: { $in: emails } }, undefined, context)
    if (existingUsers.length > 0) {
      const taken = existingUsers.map((u) => u.email).join(', ')
      throw new AppError({
        type: ErrorTypes.CONFLICT,
        message: `Users already exist for: ${taken}`,
      })
    }

    return this.withTransaction(context, async (ctx) => {
      const inviteData = data.map((d) => {
        const { token, expiresAt } = this.generateInviteToken(d.email)
        return { email: d.email, token, expiresAt }
      })
      const invites = await this.inviteRepository.createMany(inviteData, ctx)
      return invites
    })
  }

  async retrieveInvite(inviteId: string, config?: FindConfig<InviteDTO>, context?: Context): Promise<InviteDTO> {
    return this.inviteRepository.findByIdOrFail(inviteId, config, context)
  }

  async listInvites(
    filters?: FilterableInviteProps,
    config?: FindConfig<InviteDTO>,
    context?: Context,
  ): Promise<InviteDTO[]> {
    return this.inviteRepository.find(filters, config, context)
  }

  async listAndCountInvites(
    filters?: FilterableInviteProps,
    config?: FindConfig<InviteDTO>,
    context?: Context,
  ): Promise<[InviteDTO[], number]> {
    const [rows, count] = await this.inviteRepository.findAndCount(filters, config, context)
    return [rows, count]
  }

  async updateInvites(inviteIds: string[], data: UpdateInviteDTO, context?: Context): Promise<InviteDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.inviteRepository.updateMany(inviteIds, data, ctx)
    })
  }

  async createInvite(data: CreateInviteDTO, context?: Context): Promise<InviteDTO> {
    this.logger.debug(`Creating invite for ${data.email}`)

    const existingUsers = await this.userRepository.find({ email: { $in: [data.email] } }, undefined, context)
    if (existingUsers.length > 0) {
      throw new AppError({
        type: ErrorTypes.CONFLICT,
        message: `User already exists for: ${data.email}`,
      })
    }

    return this.withTransaction(context, async (ctx) => {
      const { token, expiresAt } = this.generateInviteToken(data.email)
      const invite = await this.inviteRepository.create({ email: data.email, token, expiresAt }, ctx)
      return invite
    })
  }

  async updateInvite(inviteId: string, data: UpdateInviteDTO, context?: Context): Promise<InviteDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.inviteRepository.update(inviteId, data, ctx)
    })
  }

  async softDeleteInvites(inviteIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.inviteRepository.softDelete(inviteIds, ctx)
    })
  }

  async restoreInvites(inviteIds: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.inviteRepository.restore(inviteIds, ctx)
    })
  }

  async validateInviteToken(token: string): Promise<InviteDTO> {
    let decoded: InviteTokenPayload
    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as InviteTokenPayload
    } catch {
      throw new AppError({ type: ErrorTypes.INVALID_DATA, message: 'Invalid or expired invite token' })
    }

    if (decoded.purpose !== 'invite') {
      throw new AppError({ type: ErrorTypes.INVALID_DATA, message: 'Invalid invite token' })
    }

    const [invite] = await this.inviteRepository.find({ email: decoded.email })
    if (!invite) {
      throw new AppError({ type: ErrorTypes.NOT_FOUND, message: 'Invite not found' })
    }

    // Rotation guard: only the latest token is valid
    if (invite.token !== token) {
      throw new AppError({ type: ErrorTypes.INVALID_DATA, message: 'Invite token has been superseded' })
    }

    if (invite.expiresAt < new Date()) {
      throw new AppError({ type: ErrorTypes.INVALID_DATA, message: 'Invite token has expired' })
    }

    if (invite.accepted) {
      throw new AppError({ type: ErrorTypes.CONFLICT, message: 'Invite has already been accepted' })
    }

    return invite
  }

  async refreshInviteToken(inviteId: string, context?: Context): Promise<InviteDTO> {
    return this.withTransaction(context, async (ctx) => {
      const invite = await this.inviteRepository.findByIdOrFail(inviteId, undefined, ctx)
      const { token, expiresAt } = this.generateInviteToken(invite.email)
      return this.inviteRepository.update(inviteId, { token, expiresAt }, ctx)
    })
  }

  async refreshInviteTokens(inviteIds: string[], context?: Context): Promise<InviteDTO[]> {
    this.logger.debug(`Refreshing tokens for ${inviteIds.length} invite(s)`)
    return this.withTransaction(context, async (ctx) => {
      return Promise.all(inviteIds.map((id) => this.refreshInviteToken(id, ctx)))
    })
  }

  private generateInviteToken(email: string): { token: string; expiresAt: Date } {
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000)

    const token = jwt.sign({ email, purpose: 'invite' } satisfies InviteTokenPayload, env.JWT_SECRET, {
      expiresIn: `${INVITE_EXPIRY_HOURS}h`,
      jwtid: crypto.randomUUID(),
    })

    return { token, expiresAt }
  }
}
