import { BaseRepository } from '../../../core/utils/base-repository.js'
import { roleTable } from '../models/role.js'

export class RoleRepository extends BaseRepository(roleTable) {}
