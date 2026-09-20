import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { loadFileProviders } from './loaders/providers.js'
import { FileModuleService } from './services/file-module-service.js'

export default Module(Modules.FILE, {
  service: FileModuleService,
  features: [
    { id: 'file.read', title: 'View uploads' },
    { id: 'file.create', title: 'Upload files' },
    { id: 'file.delete', title: 'Delete uploads' },
  ],
  models: {},
  repositories: {},
  loaders: [loadFileProviders],
})
