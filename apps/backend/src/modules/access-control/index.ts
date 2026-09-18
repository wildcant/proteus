import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { AccessControlModuleService } from './services/access-control-module-service.js'

export default Module(Modules.ACCESS_CONTROL, {
  service: AccessControlModuleService,
  features: [
    { id: 'access-control.role.read', title: 'View roles' },
    { id: 'access-control.role.manage', title: 'Manage roles' },
    { id: 'access-control.assignment.read', title: 'View role assignments' },
    { id: 'access-control.assignment.manage', title: 'Manage role assignments' },
  ],
  models: {},
  repositories: {},
})
