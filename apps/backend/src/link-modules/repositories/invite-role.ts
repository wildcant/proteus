import { and, inArray, isNull } from 'drizzle-orm'
import type { Context } from '../../core/types/context.js'
import { BaseRepository } from '../../core/utils/base-repository.js'
import { inviteRoleTable } from '../definitions/invite-role.js'

export class InviteRoleRepository extends BaseRepository(inviteRoleTable) {
  async findByInviteId(inviteId: string, context?: Context) {
    const client = this.getClient(context)
    return client
      .select()
      .from(this.table)
      .where(and(inArray(this.table.inviteId, [inviteId]), isNull(this.table.deletedAt)))
  }

  async findByInviteIds(inviteIds: string[], context?: Context) {
    if (inviteIds.length === 0) return []
    const client = this.getClient(context)
    return client
      .select()
      .from(this.table)
      .where(and(inArray(this.table.inviteId, inviteIds), isNull(this.table.deletedAt)))
  }
}
