import { BaseRepository } from '../../../core/utils/base-repository.js'
import { permissionTable } from '../models/permission.js'

export class PermissionRepository extends BaseRepository(permissionTable) {}
