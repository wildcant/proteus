import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { test } from '@tests/setup/test-extend.js'
import { createWithTransaction } from '../../../core/utils/with-transaction.js'
import { InviteRepository } from '../repositories/invite.js'
import { UserRepository } from '../repositories/user.js'
import { UserModuleService } from '../services/user-module-service.js'

let service: UserModuleService

test.beforeEach(({ getDb, logger }) => {
  const inviteRepository = new InviteRepository({ getDb })
  const userRepository = new UserRepository({ getDb })
  const withTransaction = createWithTransaction(getDb)
  service = new UserModuleService({ inviteRepository, userRepository, withTransaction, logger })
})

test.describe('UserModuleService', () => {
  test('createUsers', async ({ expect, dto }) => {
    const input = [dto.generate.createUser(), dto.generate.createUser()]

    const result = await service.createUsers(input)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      name: input[0]?.name,
      email: input[0]?.email,
    })
    expect(result[0]?.id).toBeDefined()
    expect(result[0]?.createdAt).toBeInstanceOf(Date)
  })

  test('retrieveUser', async ({ expect, dto }) => {
    const created = await service.createUser(dto.generate.createUser())

    const result = await service.retrieveUser(created.id)

    expect(result).toMatchObject({
      id: created.id,
      name: created.name,
      email: created.email,
    })
  })

  test('listUsers', async ({ expect, dto }) => {
    await service.createUsers([dto.generate.createUser(), dto.generate.createUser(), dto.generate.createUser()])

    const result = await service.listUsers()

    expect(result).toHaveLength(3)
  })

  test('listAndCountUsers', async ({ expect, dto }) => {
    await service.createUsers([dto.generate.createUser(), dto.generate.createUser(), dto.generate.createUser()])

    const [rows, count] = await service.listAndCountUsers()

    expect(rows).toHaveLength(3)
    expect(count).toBe(3)
  })

  test('updateUser', async ({ expect, dto }) => {
    const created = await service.createUser(dto.generate.createUser())
    const update = dto.generate.updateUser({ name: 'Updated Name' })

    const updated = await service.updateUser(created.id, update)

    expect(updated.name).toBe('Updated Name')
    expect(updated.id).toBe(created.id)
  })

  test('deleteUsers', async ({ expect, dto }) => {
    const created = await service.createUser(dto.generate.createUser())

    await service.deleteUsers([created.id])

    const error = await service.retrieveUser(created.id).catch((e) => e)
    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.NOT_FOUND)
  })

  test('softDeleteUsers', async ({ expect, dto }) => {
    const created = await service.createUser(dto.generate.createUser())

    await service.softDeleteUsers([created.id])

    const users = await service.listUsers()
    expect(users).toHaveLength(0)
  })

  test('restoreUsers', async ({ expect, dto }) => {
    const created = await service.createUser(dto.generate.createUser())
    await service.softDeleteUsers([created.id])

    await service.restoreUsers([created.id])

    const list = await service.listUsers()
    expect(list).toHaveLength(1)
    expect(list[0]?.id).toBe(created.id)
  })

  test.describe('error paths', () => {
    test('retrieveUser throws NOT_FOUND for non-existent id', async ({ expect }) => {
      const error = await service.retrieveUser('usr_nonexistent').catch((e) => e)

      expect(AppError.isError(error)).toBe(true)
      expect(error.type).toBe(ErrorTypes.NOT_FOUND)
      expect(error.message).toContain('usr_nonexistent')
    })

    test('retrieveUser throws NOT_FOUND for soft-deleted user', async ({ expect, dto }) => {
      const created = await service.createUser(dto.generate.createUser())
      await service.softDeleteUsers([created.id])

      const error = await service.retrieveUser(created.id).catch((e) => e)

      expect(AppError.isError(error)).toBe(true)
      expect(error.type).toBe(ErrorTypes.NOT_FOUND)
    })

    test('createUsers with missing required field throws INVALID_DATA', async ({ expect }) => {
      // biome-ignore lint/suspicious/noExplicitAny: intentionally invalid input to test runtime error
      const invalid = { name: 'Test' } as any

      const error = await service.createUsers([invalid]).catch((e) => e)

      expect(AppError.isError(error)).toBe(true)
      expect(error.type).toBe(ErrorTypes.INVALID_DATA)
    })

    test('updateUsers with non-existent ids returns empty array', async ({ expect, dto }) => {
      const update = dto.generate.updateUser({ name: 'Ghost' })

      const result = await service.updateUsers(['usr_nonexistent'], update)

      expect(result).toEqual([])
    })

    test('updateUsers with soft-deleted id returns empty array', async ({ expect, dto }) => {
      const created = await service.createUser(dto.generate.createUser())
      await service.softDeleteUsers([created.id])
      const update = dto.generate.updateUser({ name: 'Ghost' })

      const result = await service.updateUsers([created.id], update)

      expect(result).toEqual([])
    })

    test('deleteUsers with non-existent ids does not throw', async ({ expect }) => {
      await expect(service.deleteUsers(['usr_nonexistent'])).resolves.toBeUndefined()
    })

    test('softDeleteUsers with non-existent ids does not throw', async ({ expect }) => {
      await expect(service.softDeleteUsers(['usr_nonexistent'])).resolves.toBeUndefined()
    })

    test('restoreUsers on non-soft-deleted user does not throw', async ({ expect, dto }) => {
      const created = await service.createUser(dto.generate.createUser())

      await expect(service.restoreUsers([created.id])).resolves.toBeUndefined()
    })

    test('createUsers with empty array returns empty array', async ({ expect }) => {
      const result = await service.createUsers([])

      expect(result).toEqual([])
    })

    test('updateUsers with empty ids returns empty array', async ({ expect, dto }) => {
      const update = dto.generate.updateUser()

      const result = await service.updateUsers([], update)

      expect(result).toEqual([])
    })

    test('deleteUsers with empty ids does not throw', async ({ expect }) => {
      await expect(service.deleteUsers([])).resolves.toBeUndefined()
    })

    test('softDeleteUsers with empty ids does not throw', async ({ expect }) => {
      await expect(service.softDeleteUsers([])).resolves.toBeUndefined()
    })

    test('restoreUsers with empty ids does not throw', async ({ expect }) => {
      await expect(service.restoreUsers([])).resolves.toBeUndefined()
    })
  })
})
