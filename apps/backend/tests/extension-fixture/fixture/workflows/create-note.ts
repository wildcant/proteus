import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { createWorkflow } from '@core/workflows/types.js'
import { FixtureEvents } from '../events.js'
import { FixtureModules } from '../keys.js'
import type { CreateFixtureNoteDTO, FixtureNoteDTO } from '../types/notes.js'

/**
 * A workflow though it touches one module, which the workflow standard would make a service method:
 * it publishes `NOTE_CREATED`, and an event is published only from a workflow's final step
 * (ADR-0024), so the fixture needs one to cover an extension's event end to end.
 */
export const createFixtureNoteWorkflow = createWorkflow<CreateFixtureNoteDTO, FixtureNoteDTO>(
  { name: 'fixture.create-note' },
  async (ctx, input) => {
    const note = await ctx.step(
      'create-note',
      async ({ container }) => container.resolve(FixtureModules.NOTES).createNote(input),
      async (created, { container }) => {
        await container.resolve(FixtureModules.NOTES).deleteNotes([created.id])
      },
    )

    // Events only from the final step (ADR-0024).
    await ctx.step('publish-note-created', async ({ container }) => {
      await container.resolve(ContainerRegistrationKeys.EVENT_BUS).emit(FixtureEvents.NOTE_CREATED, { id: note.id })
    })

    return note
  },
)
