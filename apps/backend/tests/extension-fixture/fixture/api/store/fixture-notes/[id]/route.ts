import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { FixtureModules } from '../../../../keys.js'
import { FixtureNoteParams, FixtureNoteResponse } from '../../../../schemas/notes.js'

export const GetInput = { params: FixtureNoteParams }
export const GetOutput = FixtureNoteResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const note = await req.scope.resolve(FixtureModules.NOTES).retrieveNote(req.params.id)
  return { status: 200, json: { note } }
}
