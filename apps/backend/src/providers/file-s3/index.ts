import { ModuleProvider } from '../../core/utils/module-provider.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { S3FileProvider } from './s3-file-provider.js'

export default ModuleProvider(Modules.FILE, {
  services: [S3FileProvider],
})
