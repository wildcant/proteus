import type { Context } from '@core/types/context.js'

export type FixtureNoteDTO = {
  id: string
  title: string
  coreProductId: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type CreateFixtureNoteDTO = { title: string; coreProductId?: string | null }

/** The notes module's contract, carried by its module key rather than by core's closed list. */
export type IFixtureNotesService = {
  createNote(data: CreateFixtureNoteDTO, context?: Context): Promise<FixtureNoteDTO>
  listNotes(context?: Context): Promise<FixtureNoteDTO[]>
  retrieveNote(id: string, context?: Context): Promise<FixtureNoteDTO>
  deleteNotes(ids: string[], context?: Context): Promise<void>
}
