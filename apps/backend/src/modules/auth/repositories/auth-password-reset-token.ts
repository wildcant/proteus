import { eq, inArray } from 'drizzle-orm'
import { dbErrorMapper } from '../../../core/errors/db-error-mapper.js'
import type { Context } from '../../../core/types/context.js'
import type { Database } from '../../../schema.type.js'
import { authPasswordResetTokenTable } from '../models/auth-password-reset-token.js'

type AuthPasswordResetToken = typeof authPasswordResetTokenTable.$inferSelect
type CreateAuthPasswordResetToken = typeof authPasswordResetTokenTable.$inferInsert

export class AuthPasswordResetTokenRepository {
  #getDb: () => Database

  constructor({ getDb }: { getDb: () => Database }) {
    this.#getDb = getDb
  }

  private getClient(context?: Context) {
    return (context?.transaction as Database) ?? this.#getDb()
  }

  async create(data: CreateAuthPasswordResetToken, context?: Context): Promise<AuthPasswordResetToken> {
    const client = this.getClient(context)
    const rows = await client.insert(authPasswordResetTokenTable).values(data).returning().catch(dbErrorMapper)
    return rows[0] as AuthPasswordResetToken
  }

  async findByTokenHash(tokenHash: string, context?: Context): Promise<AuthPasswordResetToken | null> {
    const client = this.getClient(context)
    const rows = await client
      .select()
      .from(authPasswordResetTokenTable)
      .where(eq(authPasswordResetTokenTable.tokenHash, tokenHash))
      .catch(dbErrorMapper)
    return (rows[0] as AuthPasswordResetToken) ?? null
  }

  async deleteByProviderIdentityId(providerIdentityId: string, context?: Context): Promise<void> {
    const client = this.getClient(context)
    await client
      .delete(authPasswordResetTokenTable)
      .where(eq(authPasswordResetTokenTable.providerIdentityId, providerIdentityId))
      .catch(dbErrorMapper)
  }

  async delete(ids: string[], context?: Context): Promise<void> {
    if (ids.length === 0) return
    const client = this.getClient(context)
    await client
      .delete(authPasswordResetTokenTable)
      .where(inArray(authPasswordResetTokenTable.id, ids))
      .catch(dbErrorMapper)
  }
}
