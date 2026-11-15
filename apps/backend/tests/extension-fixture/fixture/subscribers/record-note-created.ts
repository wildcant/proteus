import type { SubscriberArgs, SubscriberConfig } from '@core/event-bus/types.js'
import { FixtureEvents } from '../events.js'
import { FixtureModules } from '../keys.js'

type NoteCreated = typeof FixtureEvents.NOTE_CREATED

/** Leaves a note naming the delivery it received, which is what the journey test reads back. */
async function recordNoteCreated({ event, container }: SubscriberArgs<NoteCreated>) {
  const notes = container.resolve(FixtureModules.NOTES)
  const title = `Received ${event.dispatchId}`
  const existing = await notes.listNotes()
  // At-least-once delivery: a repeat finds its own note and writes nothing.
  if (existing.some((note) => note.title === title)) return
  await notes.createNote({ title, coreProductId: event.data.id })
}

export const config: SubscriberConfig<NoteCreated> = {
  name: 'fixture.record-note-created',
  event: FixtureEvents.NOTE_CREATED,
  handler: recordNoteCreated,
}
