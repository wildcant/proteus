import type { ModuleProviderExports } from '../../utils/module-provider.js'
import type { BaseFilterable, OperatorMap } from '../common.js'

// ---------------------------------------------------------------------------
// Status enum
// ---------------------------------------------------------------------------

export type NotificationStatus = 'pending' | 'success' | 'failure'
export type NotificationChannel = 'email' | 'sms' | 'feed'

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export type NotificationDTO = {
  id: string
  to: string
  from: string | null
  channel: NotificationChannel
  template: string | null
  data: Record<string, unknown> | null
  providerData: Record<string, unknown> | null
  triggerType: string | null
  resourceId: string | null
  resourceType: string | null
  receiverId: string | null
  originalNotificationId: string | null
  idempotencyKey: string | null
  externalId: string | null
  status: NotificationStatus
  providerId: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type NotificationProviderDTO = {
  id: string
  name: string
  isEnabled: boolean
  channels: NotificationChannel[]
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

// ---------------------------------------------------------------------------
// Filterable types
// ---------------------------------------------------------------------------

export interface FilterableNotificationProps extends BaseFilterable<FilterableNotificationProps> {
  id?: string | string[]
  channel?: NotificationChannel | NotificationChannel[]
  status?: NotificationStatus | NotificationStatus[]
  providerId?: string | string[]
  receiverId?: string | string[]
  resourceType?: string | string[]
  idempotencyKey?: string | string[]
  createdAt?: OperatorMap<Date>
  updatedAt?: OperatorMap<Date>
}

export interface FilterableNotificationProviderProps extends BaseFilterable<FilterableNotificationProviderProps> {
  id?: string | string[]
  isEnabled?: boolean
}

// ---------------------------------------------------------------------------
// Module configuration
// ---------------------------------------------------------------------------

export type NotificationProviderConfig = {
  resolve: ModuleProviderExports
  id: string
  channels: NotificationChannel[]
  options?: Record<string, unknown>
}

export type NotificationModuleOptions = {
  providers?: NotificationProviderConfig[]
}
