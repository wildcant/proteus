import { noopLogger } from '@core/logger/noop-logger.js'
import { createRegistry, documentInfo, generateDocument } from '@framework/http/openapi/registry.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import { sql } from 'drizzle-orm'
import { runExtensionSeeds } from '../../../scripts/seed/extensions.js'
import { prepareRoutes } from '../../../src/routes.js'
import { FixtureModules } from '../fixture/keys.js'
import { extensionRegistry as fixtureRegistry } from '../registry.gen.js'
import { EXTENSION_SEEDS } from '../seeds.gen.js'

type NoteBody = { note: { id: string; title: string } }
type NoteListBody = { notes: { id: string; title: string; coreProductId: string | null }[] }

const spanish = { headers: { 'x-proteus-locale': 'es-CO' } }

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  // The fixture's routes come from its registry, mounted with the namespace auth prepareRoutes adds.
  api = await createApi({ definitions: fixtureRegistry.routes.store, namespaceAuth: true })
})

/**
 * The fixture extension stands in for a fork's: if any part of the mechanism stops wiring an
 * extension in — its module, migration, route, workflow, subscriber, seed or catalog — this fails.
 */
test('an extension runs beside core: its module, table, route, workflow, subscriber, seed and messages', async ({
  db,
  expect,
}) => {
  // Its migration ran on the test database, under its own migrations table.
  const [table] = await db.execute<{ name: string | null }>(sql`SELECT to_regclass('fixture_notes')::text AS name`)
  expect(table?.name).toBe('fixture_notes')

  // Its module resolves from the shared container through its key.
  expect(await api.container.resolve(FixtureModules.NOTES).listNotes()).toEqual([])

  // Its route answers, and runs its workflow, whose final step publishes its event.
  const created = await api.post<NoteBody>('/store/fixture-notes', { title: 'First note' })
  expect(created.status).toBe(201)
  expect(created.body.note.title).toBe('First note')

  // Its subscriber received that event, under the identity the event declared.
  const afterCreate = await api.get<NoteListBody>('/store/fixture-notes')
  expect(afterCreate.body.notes.map((note) => note.title)).toEqual([
    'First note',
    `Received fixture.note_created:${created.body.note.id}:fixture.record-note-created`,
  ])

  // Its seed step runs through the dev seed's runner.
  await runExtensionSeeds(EXTENSION_SEEDS, { container: api.container, logger: noopLogger })
  const afterSeed = await api.get<NoteListBody>('/store/fixture-notes')
  expect(afterSeed.body.notes.map((note) => note.title)).toContain('Seeded fixture note')

  // Its service's message and its schema's validation message are translated from its catalog.
  const missing = await api.get<ApiErrorBody>('/store/fixture-notes/fnote_missing', undefined, spanish)
  expect(missing.status).toBe(404)
  expect(missing.body.message).toBe('No se encontró la nota de prueba "fnote_missing"')

  const invalid = await api.post<ApiErrorBody>('/store/fixture-notes', { title: 'ab' }, spanish)
  expect(invalid.status).toBe(400)
  expect(invalid.body.message).toContain('title: Una nota de prueba necesita un título de al menos tres caracteres')
})

test('route preparation puts an extension’s store routes in the store OpenAPI document', async ({ expect }) => {
  const registries = { admin: createRegistry(), store: createRegistry() }
  const routes = prepareRoutes(noopLogger, fixtureRegistry, registries)

  expect(routes.map((route) => `${route.method} ${route.matcher}`)).toEqual(
    expect.arrayContaining(['GET /store/fixture-notes', 'POST /store/fixture-notes', 'GET /store/fixture-notes/:id']),
  )

  const store = generateDocument(registries.store, documentInfo.store)
  const admin = generateDocument(registries.admin, documentInfo.admin)
  expect(store.paths?.['/store/fixture-notes']?.post?.operationId).toBe('fixtureCreateNote')
  expect(store.paths?.['/store/fixture-notes/{id}']?.get?.operationId).toBe('fixtureGetNote')
  expect(Object.keys(store.components?.schemas ?? {})).toEqual(
    expect.arrayContaining(['FixtureNote', 'FixtureNoteResponse', 'FixtureCreateNoteBody']),
  )
  expect(Object.keys(admin.paths ?? {}).some((path) => path.includes('fixture'))).toBe(false)
})
