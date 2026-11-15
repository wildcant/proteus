import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { FixtureModules } from '../../../keys.js'
import { FixtureCreateNoteBody, FixtureNoteListResponse, FixtureNoteResponse } from '../../../schemas/notes.js'
import { createFixtureNoteWorkflow } from '../../../workflows/create-note.js'

export const GetInput = {}
export const GetOutput = FixtureNoteListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const notes = await req.scope.resolve(FixtureModules.NOTES).listNotes()
  return { status: 200, json: { notes } }
}

export const PostInput = { body: FixtureCreateNoteBody }
export const PostOutput = FixtureNoteResponse
export const PostThrows = [...createFixtureNoteWorkflow.throws] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const note = await createFixtureNoteWorkflow.run(req.body)
  return { status: 201, json: { note } }
}
