import { BaseRepository } from '../../../core/utils/base-repository.js'
import { notificationTable } from '../models/notification.js'

export class NotificationRepository extends BaseRepository(notificationTable) {}
