import { ErrorTypes } from '@core/errors/app-error.js'
import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as noteByIdRoutes from './[id]/route.js'
import * as noteRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/store/fixture-notes',
    handler: noteRoutes.GET,
    auth: 'public',
    input: noteRoutes.GetInput,
    operationId: 'fixtureListNotes',
    summary: 'List the fixture notes',
    tags: [Tags.STORE],
    output: noteRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/store/fixture-notes',
    handler: noteRoutes.POST,
    auth: 'public',
    input: noteRoutes.PostInput,
    operationId: 'fixtureCreateNote',
    summary: 'Create a fixture note',
    tags: [Tags.STORE],
    output: noteRoutes.PostOutput,
    throws: noteRoutes.PostThrows,
  },
  {
    method: 'GET',
    matcher: '/store/fixture-notes/:id',
    handler: noteByIdRoutes.GET,
    auth: 'public',
    input: noteByIdRoutes.GetInput,
    operationId: 'fixtureGetNote',
    summary: 'Retrieve a fixture note',
    tags: [Tags.STORE],
    output: noteByIdRoutes.GetOutput,
    throws: [ErrorTypes.NOT_FOUND],
  },
] satisfies RouteDefinition[]
