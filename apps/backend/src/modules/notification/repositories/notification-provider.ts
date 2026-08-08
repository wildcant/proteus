import { BaseRepository } from '../../../core/utils/base-repository.js'
import { notificationProviderTable } from '../models/notification-provider.js'

export class NotificationProviderRepository extends BaseRepository(notificationProviderTable) {}
