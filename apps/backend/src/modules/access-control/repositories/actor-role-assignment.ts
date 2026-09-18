import { BaseRepository } from '../../../core/utils/base-repository.js'
import { actorRoleAssignmentTable } from '../models/actor-role-assignment.js'

export class ActorRoleAssignmentRepository extends BaseRepository(actorRoleAssignmentTable) {}
