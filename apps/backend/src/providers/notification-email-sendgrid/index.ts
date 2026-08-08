import { ModuleProvider } from '../../core/utils/module-provider.js'
import { SendGridNotificationProvider } from './sendgrid-provider.js'

export default ModuleProvider('notification-email-sendgrid', {
  services: [SendGridNotificationProvider],
})
