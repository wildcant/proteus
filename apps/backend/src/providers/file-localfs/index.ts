import { ModuleProvider } from '../../core/utils/module-provider.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { LocalFileProvider } from './local-file-provider.js'

export default ModuleProvider(Modules.FILE, {
  services: [LocalFileProvider],
})
