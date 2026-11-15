import { test } from '@tests/setup/test-extend.js'
import { defineModuleKey } from '../../extensions/module-key.js'
import { Module } from '../module.js'

type INotesService = { listNotes(): Promise<string[]> }

class NotesService implements INotesService {
  async listNotes() {
    return []
  }
}

class GrownNotesService extends NotesService {
  async purgeNotes(): Promise<void> {
    await this.listNotes()
  }
}

/**
 * Asserted by `tsc`: each `@ts-expect-error` fails `pnpm run typecheck` once the line below it
 * compiles. An extension module is checked against the service type its key carries, as a core one
 * is against `ModuleServiceContracts`, and declares no features, which are core permission keys.
 */
test('an extension module is checked against its key and declares no features', ({ expect }) => {
  const NotesKey = defineModuleKey<INotesService>('fixture.notes')

  const definition = Module(NotesKey, { service: NotesService, repositories: {}, models: {} })

  // @ts-expect-error - `purgeNotes` is a public method the key's service type never names
  Module(NotesKey, { service: GrownNotesService, repositories: {}, models: {} })

  Module(NotesKey, {
    service: NotesService,
    repositories: {},
    models: {},
    // @ts-expect-error - extension permissions do not exist yet
    features: [{ id: 'store.read', title: 'View store settings' }],
  })

  expect(definition.key).toBe('fixture.notes')
})
