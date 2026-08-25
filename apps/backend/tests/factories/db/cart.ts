import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import { type CreateCart, cartTable } from '../../../src/schema.js'
import { db } from '../../db/client.js'

export function generateCart(overrides?: Partial<CreateCart>): CreateCart {
  return {
    id: `cart_${faker.string.alphanumeric(32)}`,
    regionId: faker.string.alphanumeric(20),
    customerId: `cus_${faker.string.alphanumeric(32)}`,
    salesChannelId: faker.string.alphanumeric(20),
    email: faker.internet.email(),
    currencyCode: faker.helpers.arrayElement(['usd', 'eur', 'gbp']),
    completedAt: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createCart(overrides?: Partial<CreateCart>) {
  const values = generateCart(overrides)
  const result = await db.insert(cartTable).values(values).returning()
  const cart = result[0]
  if (!cart) throw new Error('Cart insert returned no rows')

  return {
    ...cart,
    [Symbol.asyncDispose]: async () => {
      await deleteCartById(cart.id)
    },
  }
}

export async function deleteCartById(cartId: string) {
  await db.delete(cartTable).where(eq(cartTable.id, cartId))
}
