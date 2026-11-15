import { defineModuleKey } from '@core/extensions/module-key.js'
import type { IFixtureNotesService } from './types/notes.js'
import type { IFixtureShippingRatesService } from './types/shipping-rates.js'

export const FixtureModules = {
  NOTES: defineModuleKey<IFixtureNotesService>('fixture.notes'),
  SHIPPING_RATES: defineModuleKey<IFixtureShippingRatesService>('fixture.shipping-rates'),
}
