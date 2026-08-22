import { ErrorTypes } from '@core/errors/app-error.js'
import { test } from '@tests/setup/test-extend.js'
import { vi } from 'vitest'
import { createWithTransaction } from '../../../core/utils/with-transaction.js'

import { NotificationRepository } from '../repositories/notification.js'
import { NotificationModuleService } from '../services/notification-module-service.js'
import type { NotificationProviderService } from '../services/notification-provider-service.js'

function createMockProviderService() {
  return {
    resolveProviderForChannel: vi.fn().mockResolvedValue('default'),
    send: vi.fn().mockResolvedValue({}),
    retrieveProvider: vi.fn(),
    upsert: vi.fn(),
    disableRemovedProviders: vi.fn(),
  }
}

let service: NotificationModuleService
let mockProvider: ReturnType<typeof createMockProviderService>

test.beforeEach(({ getDb, logger }) => {
  mockProvider = createMockProviderService()

  service = new NotificationModuleService({
    notificationRepository: new NotificationRepository({ getDb }),
    notificationProviderService: mockProvider as unknown as NotificationProviderService,
    withTransaction: createWithTransaction(getDb),
    logger,
  })
})

test.describe('NotificationModuleService', () => {
  // ---------------------------------------------------------------------------
  // Batch creation with status tracking
  // ---------------------------------------------------------------------------

  test.describe('createNotifications', () => {
    test('creates a batch of notifications with SUCCESS status', async ({ expect, dto }) => {
      const input = [dto.generate.createNotification(), dto.generate.createNotification({ to: 'other@example.com' })]

      const result = await service.createNotifications(input)

      expect(result).toHaveLength(2)
      expect(result[0]?.status).toBe('success')
      expect(result[1]?.status).toBe('success')
      expect(result[0]?.id).toMatch(/^noti_/)
      expect(result[0]?.createdAt).toBeInstanceOf(Date)
      expect(mockProvider.send).toHaveBeenCalledTimes(2)
    })

    test('singular createNotification', async ({ expect, dto }) => {
      const result = await service.createNotification(dto.generate.createNotification())

      expect(result.id).toMatch(/^noti_/)
      expect(result.to).toBe('user@example.com')
      expect(result.channel).toBe('feed')
      expect(result.status).toBe('success')
    })

    test('sets data fields from input', async ({ expect, dto }) => {
      const result = await service.createNotification(
        dto.generate.createNotification({
          from: 'system@app.com',
          template: 'welcome',
          data: { key: 'value' },
          triggerType: 'workflow',
          resourceId: 'order_123',
          resourceType: 'order',
          receiverId: 'cus_456',
        }),
      )

      expect(result).toMatchObject({
        from: 'system@app.com',
        template: 'welcome',
        data: { key: 'value' },
        triggerType: 'workflow',
        resourceId: 'order_123',
        resourceType: 'order',
        receiverId: 'cus_456',
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Idempotency
  // ---------------------------------------------------------------------------

  test.describe('idempotency', () => {
    test('skips non-failure duplicates (SUCCESS)', async ({ expect, dto }) => {
      const input = dto.generate.createNotification({ idempotencyKey: 'idem_1' })

      const first = await service.createNotification(input)
      expect(first.status).toBe('success')

      const second = await service.createNotifications([input])
      expect(second).toHaveLength(1)
      expect(second[0]?.id).toBe(first.id)
      // Provider should only be called once — second call skips
      expect(mockProvider.send).toHaveBeenCalledTimes(1)
    })

    test('retries FAILURE notifications', async ({ expect, dto }) => {
      const input = dto.generate.createNotification({ idempotencyKey: 'idem_fail' })

      // First call fails (provider throws)
      mockProvider.send.mockRejectedValueOnce(new Error('provider down'))
      const first = await service.createNotification(input)
      expect(first.status).toBe('failure')

      // Second call should retry
      mockProvider.send.mockResolvedValueOnce({})
      const second = await service.createNotifications([input])
      expect(second).toHaveLength(1)
      expect(second[0]?.id).toBe(first.id)
      expect(second[0]?.status).toBe('success')
      expect(mockProvider.send).toHaveBeenCalledTimes(2)
    })

    test('retried failure stays FAILURE when provider is no longer available', async ({ expect, dto }) => {
      const input = dto.generate.createNotification({ idempotencyKey: 'idem_no_provider' })

      // First call fails
      mockProvider.send.mockRejectedValueOnce(new Error('provider down'))
      const first = await service.createNotification(input)
      expect(first.status).toBe('failure')

      // Provider no longer resolves for this channel
      mockProvider.resolveProviderForChannel.mockResolvedValue(null)
      const second = await service.createNotifications([input])
      expect(second).toHaveLength(1)
      expect(second[0]?.id).toBe(first.id)
      expect(second[0]?.status).toBe('failure')
      // send should not be called again since no provider
      expect(mockProvider.send).toHaveBeenCalledTimes(1)
    })

    test('handles mixed batch with idempotent and non-idempotent inputs', async ({ expect, dto }) => {
      const idempotentInput = dto.generate.createNotification({ to: 'idem@example.com', idempotencyKey: 'idem_mix' })
      const first = await service.createNotification(idempotentInput)

      const result = await service.createNotifications([
        idempotentInput, // should skip (already succeeded)
        dto.generate.createNotification({ to: 'new@example.com' }), // new, no idempotency key
      ])

      expect(result).toHaveLength(2)
      expect(result[0]?.id).toBe(first.id) // skipped duplicate
      expect(result[1]?.id).not.toBe(first.id) // new record
      expect(result[1]?.status).toBe('success')
      // send called once for first creation + once for new record (skip doesn't call send)
      expect(mockProvider.send).toHaveBeenCalledTimes(2)
    })
  })

  // ---------------------------------------------------------------------------
  // Provider failure handling
  // ---------------------------------------------------------------------------

  test.describe('provider failure', () => {
    test('sets FAILURE status without blocking other notifications in batch', async ({ expect, dto }) => {
      // First notification will fail, second will succeed
      mockProvider.send.mockRejectedValueOnce(new Error('provider error')).mockResolvedValueOnce({})

      const result = await service.createNotifications([
        dto.generate.createNotification({ to: 'fail@example.com' }),
        dto.generate.createNotification({ to: 'success@example.com' }),
      ])

      expect(result).toHaveLength(2)
      const failed = result.find((n) => n.to === 'fail@example.com')
      const succeeded = result.find((n) => n.to === 'success@example.com')
      expect(failed?.status).toBe('failure')
      expect(succeeded?.status).toBe('success')
    })

    test('sets FAILURE status when no provider exists for channel', async ({ expect, dto }) => {
      mockProvider.resolveProviderForChannel.mockResolvedValue(null)

      const result = await service.createNotification(dto.generate.createNotification({ channel: 'feed' }))

      expect(result.status).toBe('failure')
      expect(mockProvider.send).not.toHaveBeenCalled()
    })

    test('no-provider failure is persisted in the database', async ({ expect, dto }) => {
      mockProvider.resolveProviderForChannel.mockResolvedValue(null)

      const result = await service.createNotification(dto.generate.createNotification())
      const retrieved = await service.retrieveNotification(result.id)

      expect(retrieved.status).toBe('failure')
    })
  })

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  test.describe('edge cases', () => {
    test('empty batch returns empty array', async ({ expect }) => {
      const result = await service.createNotifications([])

      expect(result).toEqual([])
      expect(mockProvider.send).not.toHaveBeenCalled()
    })

    test('stores providerData and externalId from provider response', async ({ expect, dto }) => {
      mockProvider.send.mockResolvedValueOnce({
        externalId: 'ext_abc123',
        data: { messageId: 'msg_789', provider: 'sendgrid' },
      })

      const result = await service.createNotification(dto.generate.createNotification())

      expect(result.externalId).toBe('ext_abc123')
      expect(result.providerData).toEqual({ messageId: 'msg_789', provider: 'sendgrid' })

      // Verify persisted in DB
      const retrieved = await service.retrieveNotification(result.id)
      expect(retrieved.externalId).toBe('ext_abc123')
      expect(retrieved.providerData).toEqual({ messageId: 'msg_789', provider: 'sendgrid' })
    })

    test('result order matches input order', async ({ expect, dto }) => {
      const input = [
        dto.generate.createNotification({ to: 'first@example.com' }),
        dto.generate.createNotification({ to: 'second@example.com' }),
        dto.generate.createNotification({ to: 'third@example.com' }),
      ]

      const result = await service.createNotifications(input)

      expect(result[0]?.to).toBe('first@example.com')
      expect(result[1]?.to).toBe('second@example.com')
      expect(result[2]?.to).toBe('third@example.com')
    })

    test('multiple channels in batch resolve to correct providers', async ({ expect, dto }) => {
      mockProvider.resolveProviderForChannel.mockImplementation(async (channel: string) => {
        if (channel === 'email') return 'sendgrid'
        if (channel === 'sms') return 'twilio'
        return null
      })

      const result = await service.createNotifications([
        dto.generate.createNotification({ to: 'user@example.com', channel: 'email' }),
        dto.generate.createNotification({ to: '+1234567890', channel: 'sms' }),
      ])

      expect(result).toHaveLength(2)
      expect(result[0]?.status).toBe('success')
      expect(result[1]?.status).toBe('success')
      expect(result[0]?.providerId).toBe('sendgrid')
      expect(result[1]?.providerId).toBe('twilio')
      expect(mockProvider.send).toHaveBeenCalledTimes(2)
      expect(mockProvider.send).toHaveBeenCalledWith('sendgrid', expect.objectContaining({ channel: 'email' }))
      expect(mockProvider.send).toHaveBeenCalledWith('twilio', expect.objectContaining({ channel: 'sms' }))
    })

    test('retried failure stores updated providerData and externalId', async ({ expect, dto }) => {
      const input = dto.generate.createNotification({ idempotencyKey: 'idem_retry_data' })

      mockProvider.send.mockRejectedValueOnce(new Error('provider down'))
      const first = await service.createNotification(input)
      expect(first.status).toBe('failure')

      mockProvider.send.mockResolvedValueOnce({ externalId: 'ext_retry', data: { retried: true } })
      const second = await service.createNotifications([input])

      expect(second[0]?.status).toBe('success')
      expect(second[0]?.externalId).toBe('ext_retry')
      expect(second[0]?.providerData).toEqual({ retried: true })

      // Verify persisted
      const retrieved = await service.retrieveNotification(first.id)
      expect(retrieved.externalId).toBe('ext_retry')
      expect(retrieved.providerData).toEqual({ retried: true })
    })
  })

  // ---------------------------------------------------------------------------
  // retrieveNotification
  // ---------------------------------------------------------------------------

  test.describe('retrieveNotification', () => {
    test('retrieves by ID', async ({ expect, dto }) => {
      const created = await service.createNotification(dto.generate.createNotification())

      const retrieved = await service.retrieveNotification(created.id)

      expect(retrieved.id).toBe(created.id)
      expect(retrieved.to).toBe('user@example.com')
    })

    test('throws NOT_FOUND for missing ID', async ({ expect }) => {
      const error = await service.retrieveNotification('noti_nonexistent').catch((e) => e)

      expect(error.type).toBe(ErrorTypes.NOT_FOUND)
    })
  })

  // ---------------------------------------------------------------------------
  // listNotifications
  // ---------------------------------------------------------------------------

  test.describe('listNotifications', () => {
    test('lists with pagination', async ({ expect, dto }) => {
      await service.createNotifications([
        dto.generate.createNotification({ to: 'a@example.com' }),
        dto.generate.createNotification({ to: 'b@example.com' }),
        dto.generate.createNotification({ to: 'c@example.com' }),
      ])

      const page1 = await service.listNotifications(undefined, { limit: 2, offset: 0 })
      expect(page1).toHaveLength(2)

      const page2 = await service.listNotifications(undefined, { limit: 2, offset: 2 })
      expect(page2).toHaveLength(1)
    })

    test('filters by channel', async ({ expect, dto }) => {
      mockProvider.resolveProviderForChannel.mockImplementation(async (channel: string) =>
        channel === 'feed' ? 'default' : null,
      )

      await service.createNotifications([
        dto.generate.createNotification({ channel: 'feed' }),
        dto.generate.createNotification({ channel: 'email' }),
      ])

      const feedNotifications = await service.listNotifications({ channel: 'feed' })
      expect(feedNotifications).toHaveLength(1)
      expect(feedNotifications[0]?.channel).toBe('feed')
    })

    test('filters by status', async ({ expect, dto }) => {
      mockProvider.send.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('fail'))

      await service.createNotifications([
        dto.generate.createNotification({ to: 'ok@example.com' }),
        dto.generate.createNotification({ to: 'fail@example.com' }),
      ])

      const successful = await service.listNotifications({ status: 'success' })
      expect(successful).toHaveLength(1)
      expect(successful[0]?.to).toBe('ok@example.com')
    })
  })

  // ---------------------------------------------------------------------------
  // listAndCountNotifications
  // ---------------------------------------------------------------------------

  test.describe('listAndCountNotifications', () => {
    test('returns records and total count', async ({ expect, dto }) => {
      await service.createNotifications([
        dto.generate.createNotification({ to: 'a@example.com' }),
        dto.generate.createNotification({ to: 'b@example.com' }),
        dto.generate.createNotification({ to: 'c@example.com' }),
      ])

      const [records, count] = await service.listAndCountNotifications(undefined, { limit: 2, offset: 0 })
      expect(records).toHaveLength(2)
      expect(count).toBe(3)
    })
  })
})
