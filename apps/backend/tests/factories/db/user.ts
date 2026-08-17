import { faker } from '@faker-js/faker'
import { eq, sql } from 'drizzle-orm'
import { hashPassword } from '../../../src/providers/auth-emailpass/password.js'
import { authIdentityTable, type CreateUser, providerIdentityTable, userTable } from '../../../src/schema.js'
import { db } from '../../db/client.js'

export function generateUser(overrides?: Partial<CreateUser>): CreateUser {
  return {
    id: `usr_${faker.string.alphanumeric(32)}`,
    email: faker.internet.email(),
    name: faker.person.fullName(),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createUser(overrides?: Partial<CreateUser>) {
  const password = faker.internet.password({ length: 12 })
  const hashedPassword = await hashPassword(password, { logN: 1, r: 1, p: 1 })

  const userData = generateUser(overrides)
  const result = await db.insert(userTable).values(userData).returning()
  const user = result[0]
  if (!user) throw new Error('User insert returned no rows')

  const authResult = await db
    .insert(authIdentityTable)
    .values({ appMetadata: { userId: user.id, registered: true } })
    .returning()
  const authIdentity = authResult[0]
  if (!authIdentity) throw new Error('Auth identity insert returned no rows')

  await db.insert(providerIdentityTable).values({
    authIdentityId: authIdentity.id,
    entityId: user.email,
    provider: 'emailpass',
    providerMetadata: { password: hashedPassword },
  })

  return {
    ...user,
    password,
    [Symbol.asyncDispose]: async () => {
      await deleteUserById(user.id)
    },
  }
}

export async function deleteUserById(userId: string) {
  await db.delete(authIdentityTable).where(sql`app_metadata->>'userId' = ${userId}`)
  await db.delete(userTable).where(eq(userTable.id, userId))
}
