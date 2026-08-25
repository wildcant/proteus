import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import * as models from './models/index.js'
import { InviteRepository } from './repositories/invite.js'
import { UserRepository } from './repositories/user.js'
import { UserModuleService } from './services/user-module-service.js'

export default Module(Modules.USER, {
  service: UserModuleService,
  models,
  repositories: {
    inviteRepository: InviteRepository,
    userRepository: UserRepository,
  },
})
