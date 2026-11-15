import { Module } from '@core/utils/module.js'
import { FixtureModules } from '../../keys.js'
import { fixtureNoteTable } from './models/note.js'
import { FixtureNoteRepository } from './repositories/note.js'
import { FixtureNotesModuleService } from './services/notes-module-service.js'

export default Module(FixtureModules.NOTES, {
  service: FixtureNotesModuleService,
  models: { fixtureNoteTable },
  repositories: { fixtureNoteRepository: FixtureNoteRepository },
})
