import { defineEvent } from '@core/extensions/define-event.js'

export const FixtureEvents = {
  /** A note was created through the create-note workflow. Once per note, so keyed by its id. */
  NOTE_CREATED: defineEvent<{ id: string }>({ name: 'fixture.note_created' }),
}
