import { BaseRepository } from '../../../core/utils/base-repository.js'
import { regionTable } from '../models/region.js'

export class RegionRepository extends BaseRepository(regionTable) {}
