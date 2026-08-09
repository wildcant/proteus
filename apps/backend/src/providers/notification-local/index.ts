import { ModuleProvider } from '../../core/utils/module-provider.js'
import { LocalNotificationProvider } from './local-provider.js'

export default ModuleProvider('notification-local', {
  services: [LocalNotificationProvider],
})
