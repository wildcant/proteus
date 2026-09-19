import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { inviteTable } from './models/invite.js'
import { userTable } from './models/user.js'
import { InviteRepository } from './repositories/invite.js'
import { UserRepository } from './repositories/user.js'
import { UserModuleService } from './services/user-module-service.js'

export default Module(Modules.USER, {
  service: UserModuleService,
  features: [
    { id: 'user.read', title: 'View users' },
    { id: 'user.create', title: 'Create users' },
    { id: 'user.update', title: 'Edit users' },
    { id: 'user.delete', title: 'Delete users' },
    { id: 'user.invite.read', title: 'View invites' },
    { id: 'user.invite.create', title: 'Create invites' },
    { id: 'user.invite.delete', title: 'Delete invites' },
    { id: 'user.invite.resend', title: 'Resend invites' },
  ],
  models: {
    inviteTable,
    userTable,
  },
  repositories: {
    inviteRepository: InviteRepository,
    userRepository: UserRepository,
  },
})
