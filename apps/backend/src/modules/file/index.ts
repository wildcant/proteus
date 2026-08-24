import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { loadFileProviders } from './loaders/providers.js'
import { FileModuleService } from './services/file-module-service.js'

export { fileProviderDeclarations } from './provider-declarations.js'

export default Module(Modules.FILE, {
  service: FileModuleService,
  models: {},
  repositories: {},
  loaders: [loadFileProviders],
})
