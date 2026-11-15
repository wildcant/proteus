import { BaseRepository } from '@core/utils/base-repository.js'
import { fixtureNoteTable } from '../models/note.js'

export class FixtureNoteRepository extends BaseRepository(fixtureNoteTable) {}
