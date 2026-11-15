import { defineModuleKey } from '@core/extensions/module-key.js'
import type { IFixtureNotesService } from './types/notes.js'

export const FixtureModules = {
  NOTES: defineModuleKey<IFixtureNotesService>('fixture.notes'),
}
