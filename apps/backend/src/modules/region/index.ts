import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import * as models from './models/index.js'
import { CountryRepository } from './repositories/country.js'
import { RegionRepository } from './repositories/region.js'
import { RegionModuleService } from './services/region-module-service.js'

export default Module(Modules.REGION, {
  service: RegionModuleService,
  models,
  repositories: {
    regionRepository: RegionRepository,
    countryRepository: CountryRepository,
  },
})
