import type { ExtensionSeedStep } from '@core/extensions/extension.js'
import { FixtureModules } from '../keys.js'

const seedNotes: ExtensionSeedStep = async ({ container, logger }) => {
  await container.resolve(FixtureModules.NOTES).createNote({ title: 'Seeded fixture note' })
  logger.info('[seed] fixture: one note')
}

export default seedNotes
