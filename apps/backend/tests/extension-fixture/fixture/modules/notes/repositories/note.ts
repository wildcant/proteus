import { BaseRepository } from '../../../../../../src/core/utils/base-repository.js'
import { fixtureNoteTable } from '../models/note.js'

export class FixtureNoteRepository extends BaseRepository(fixtureNoteTable) {}
