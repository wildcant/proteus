import { ModuleProvider } from '../../core/utils/module-provider.js'
import { ResendNotificationProvider } from './resend-provider.js'

export default ModuleProvider('notification-email-resend', {
  services: [ResendNotificationProvider],
})
