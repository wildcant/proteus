import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type { FindConfig } from '../../../core/types/common.js'
import type { Context } from '../../../core/types/context.js'
import type { Logger } from '../../../core/types/logger.js'
import type {
  FilterableNotificationProps,
  NotificationDTO,
  NotificationStatus,
} from '../../../core/types/notification/common.js'
import type { CreateNotificationDTO } from '../../../core/types/notification/mutations.js'
import type { INotificationModuleService } from '../../../core/types/notification/service.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { NotificationRepository } from '../repositories/notification.js'
import type { NotificationProviderService } from './notification-provider-service.js'

type ClassifiedInput =
  | { kind: 'existing'; notification: NotificationDTO }
  | { kind: 'retry'; existingId: string; providerId: string }
  | { kind: 'new'; input: CreateNotificationDTO; providerId: string | null }

type StatusUpdate = {
  status: NotificationStatus
  providerData: Record<string, unknown> | null
  externalId: string | null
}

type InjectedDependencies = {
  notificationRepository: NotificationRepository
  notificationProviderService: NotificationProviderService
  withTransaction: WithTransaction
  logger: Logger
}

export class NotificationModuleService implements INotificationModuleService {
  private notificationRepository: NotificationRepository
  private notificationProviderService: NotificationProviderService
  private withTransaction: WithTransaction
  private logger: Logger

  constructor({ notificationRepository, notificationProviderService, withTransaction, logger }: InjectedDependencies) {
    this.notificationRepository = notificationRepository
    this.notificationProviderService = notificationProviderService
    this.withTransaction = withTransaction
    this.logger = logger
  }

  // ---------------------------------------------------------------------------
  // createNotifications
  // ---------------------------------------------------------------------------

  async createNotifications(data: CreateNotificationDTO[], context?: Context): Promise<NotificationDTO[]> {
    if (data.length === 0) return []

    const { notifications, dispatchTargets } = await this.prepareNotifications(data, context)
    const statusUpdates = await this.dispatchNotifications(notifications, dispatchTargets)
    await this.persistStatusUpdates(statusUpdates)

    return notifications.map((notification) => {
      const update = statusUpdates.get(notification.id)
      return update ? { ...notification, ...update } : notification
    })
  }

  async createNotification(data: CreateNotificationDTO, context?: Context): Promise<NotificationDTO> {
    const [notification] = await this.createNotifications([data], context)
    if (!notification) {
      throw new AppError({ type: ErrorTypes.UNEXPECTED_STATE, message: 'Failed to create notification' })
    }
    return notification
  }

  // ---------------------------------------------------------------------------
  // createNotifications — private helpers
  // ---------------------------------------------------------------------------

  /**
   * Transaction phase: resolve providers, check idempotency, classify inputs,
   * batch-create new records, and return ordered notifications with dispatch targets.
   */
  private async prepareNotifications(data: CreateNotificationDTO[], context?: Context) {
    return this.withTransaction(context, async (ctx) => {
      const channelProviderMap = await this.resolveChannelProviders(data)
      const existingByKey = await this.fetchExistingByIdempotencyKeys(data, ctx)

      // Classify each input: skip existing duplicates, retry failures, or create new
      const classified: ClassifiedInput[] = []
      for (const input of data) {
        const providerId = channelProviderMap.get(input.channel) ?? null

        if (input.idempotencyKey) {
          const existing = existingByKey.get(input.idempotencyKey)
          if (existing && existing.status !== 'failure') {
            classified.push({ kind: 'existing', notification: existing })
            continue
          }
          if (existing && existing.status === 'failure') {
            classified.push(
              providerId
                ? { kind: 'retry', existingId: existing.id, providerId }
                : { kind: 'existing', notification: existing },
            )
            continue
          }
        }

        classified.push({ kind: 'new', input, providerId })
      }

      // Update retried failures to pending (concurrency guard)
      const retryItems = classified.filter(
        (item): item is Extract<ClassifiedInput, { kind: 'retry' }> => item.kind === 'retry',
      )
      const retriedRecords = await Promise.all(
        retryItems.map((item) =>
          this.notificationRepository.update(
            item.existingId,
            { status: 'pending' as const, providerId: item.providerId },
            ctx,
          ),
        ),
      )

      // Batch-create all new records in a single INSERT
      const newItems = classified.filter(
        (item): item is Extract<ClassifiedInput, { kind: 'new' }> => item.kind === 'new',
      )
      const createdRecords = await this.notificationRepository.createMany(
        newItems.map((item) => this.toInsertData(item.input, item.providerId)),
        ctx,
      )

      // Assemble ordered results and dispatch targets
      let retryIndex = 0
      let createIndex = 0
      const notifications: NotificationDTO[] = []
      const dispatchTargets: { index: number; providerId: string }[] = []

      for (const item of classified) {
        const index = notifications.length
        switch (item.kind) {
          case 'existing':
            notifications.push(item.notification)
            break
          case 'retry': {
            const record = retriedRecords[retryIndex++]
            if (!record)
              throw new AppError({ type: ErrorTypes.UNEXPECTED_STATE, message: 'Missing retried notification record' })
            notifications.push(record)
            dispatchTargets.push({ index, providerId: item.providerId })
            break
          }
          case 'new': {
            const record = createdRecords[createIndex++]
            if (!record)
              throw new AppError({ type: ErrorTypes.UNEXPECTED_STATE, message: 'Missing created notification record' })
            notifications.push(record)
            if (item.providerId) {
              dispatchTargets.push({ index, providerId: item.providerId })
            }
            break
          }
        }
      }

      return { notifications, dispatchTargets }
    })
  }

  private async resolveChannelProviders(data: CreateNotificationDTO[]) {
    const uniqueChannels = [...new Set(data.map((d) => d.channel))]
    const entries = await Promise.all(
      uniqueChannels.map(
        async (channel) =>
          [channel, await this.notificationProviderService.resolveProviderForChannel(channel)] as const,
      ),
    )
    return new Map(entries)
  }

  private async fetchExistingByIdempotencyKeys(data: CreateNotificationDTO[], context: Context) {
    const keys = data.map((d) => d.idempotencyKey).filter((key): key is string => key != null)
    if (keys.length === 0) return new Map<string, NotificationDTO>()

    const existing = await this.notificationRepository.find({ idempotencyKey: keys }, undefined, context)
    const map = new Map<string, NotificationDTO>()
    for (const notification of existing) {
      if (notification.idempotencyKey) {
        map.set(notification.idempotencyKey, notification)
      }
    }
    return map
  }

  private toInsertData(input: CreateNotificationDTO, providerId: string | null) {
    return {
      to: input.to,
      from: input.from ?? null,
      channel: input.channel,
      template: input.template ?? null,
      data: input.data ?? null,
      triggerType: input.triggerType ?? null,
      resourceId: input.resourceId ?? null,
      resourceType: input.resourceType ?? null,
      receiverId: input.receiverId ?? null,
      originalNotificationId: input.originalNotificationId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      status: providerId ? ('pending' as const) : ('failure' as const),
      providerId,
    }
  }

  /** Send notifications via providers, return status updates keyed by notification ID. */
  private async dispatchNotifications(
    notifications: NotificationDTO[],
    dispatchTargets: { index: number; providerId: string }[],
  ) {
    const statusUpdates = new Map<string, StatusUpdate>()

    await Promise.all(
      dispatchTargets.map(async ({ index, providerId }) => {
        const notification = notifications[index]
        if (!notification) return
        try {
          const providerResult = await this.notificationProviderService.send(providerId, {
            to: notification.to,
            channel: notification.channel,
            from: notification.from,
            template: notification.template,
            data: notification.data,
          })
          statusUpdates.set(notification.id, {
            status: 'success',
            providerData: providerResult.data ?? null,
            externalId: providerResult.externalId ?? null,
          })
        } catch (error) {
          this.logger.error(error instanceof Error ? error : String(error))
          statusUpdates.set(notification.id, {
            status: 'failure',
            providerData: null,
            externalId: null,
          })
        }
      }),
    )

    return statusUpdates
  }

  /** Batch-persist status updates: failures in one call, successes individually. */
  private async persistStatusUpdates(statusUpdates: Map<string, StatusUpdate>) {
    if (statusUpdates.size === 0) return

    const failureIds: string[] = []
    const successEntries: [string, StatusUpdate][] = []

    for (const [id, update] of statusUpdates) {
      if (update.status === 'failure') {
        failureIds.push(id)
      } else {
        successEntries.push([id, update])
      }
    }

    const promises: Promise<unknown>[] = []
    if (failureIds.length > 0) {
      promises.push(this.notificationRepository.updateMany(failureIds, { status: 'failure' as const }))
    }
    for (const [id, update] of successEntries) {
      promises.push(
        this.notificationRepository.update(id, {
          status: 'success' as const,
          providerData: update.providerData,
          externalId: update.externalId,
        }),
      )
    }

    await Promise.all(promises).catch((error: unknown) =>
      this.logger.error(error instanceof Error ? error : String(error)),
    )
  }

  // ---------------------------------------------------------------------------
  // Retrieval
  // ---------------------------------------------------------------------------

  async retrieveNotification(
    id: string,
    config?: FindConfig<NotificationDTO>,
    context?: Context,
  ): Promise<NotificationDTO> {
    return this.notificationRepository.findByIdOrFail(id, config, context)
  }

  async listNotifications(
    filters?: FilterableNotificationProps,
    config?: FindConfig<NotificationDTO>,
    context?: Context,
  ): Promise<NotificationDTO[]> {
    return this.notificationRepository.find(filters, config, context)
  }

  async listAndCountNotifications(
    filters?: FilterableNotificationProps,
    config?: FindConfig<NotificationDTO>,
    context?: Context,
  ): Promise<[NotificationDTO[], number]> {
    return this.notificationRepository.findAndCount(filters, config, context)
  }
}
