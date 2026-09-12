import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { countryTable } from './models/country.js'
import { regionTable } from './models/region.js'
import { CountryRepository } from './repositories/country.js'
import { RegionRepository } from './repositories/region.js'
import { RegionModuleService } from './services/region-module-service.js'

export default Module(Modules.REGION, {
  service: RegionModuleService,
  models: {
    countryTable,
    regionTable,
  },
  repositories: {
    regionRepository: RegionRepository,
    countryRepository: CountryRepository,
  },
})
