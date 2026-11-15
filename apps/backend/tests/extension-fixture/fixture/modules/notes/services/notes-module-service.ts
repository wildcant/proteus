import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { Context } from '@core/types/context.js'
import { i18n } from '@proteus/utils'
import type { CreateFixtureNoteDTO, FixtureNoteDTO, IFixtureNotesService } from '../../../types/notes.js'
import type { FixtureNoteRepository } from '../repositories/note.js'

type InjectedDependencies = {
  fixtureNoteRepository: FixtureNoteRepository
}

export class FixtureNotesModuleService implements IFixtureNotesService {
  private fixtureNoteRepository: FixtureNoteRepository

  constructor({ fixtureNoteRepository }: InjectedDependencies) {
    this.fixtureNoteRepository = fixtureNoteRepository
  }

  async createNote(data: CreateFixtureNoteDTO, context?: Context): Promise<FixtureNoteDTO> {
    return this.fixtureNoteRepository.create(data, context)
  }

  async listNotes(context?: Context): Promise<FixtureNoteDTO[]> {
    return this.fixtureNoteRepository.find(undefined, { order: { createdAt: 'ASC' } }, context)
  }

  async retrieveNote(id: string, context?: Context): Promise<FixtureNoteDTO> {
    const note = await this.fixtureNoteRepository.findById(id, undefined, context)
    if (!note) {
      throw new AppError({
        type: ErrorTypes.NOT_FOUND,
        message: i18n.t('Fixture note "{id}" was not found'),
        values: { id },
      })
    }
    return note
  }

  async deleteNotes(ids: string[], context?: Context): Promise<void> {
    await this.fixtureNoteRepository.delete(ids, context)
  }
}
