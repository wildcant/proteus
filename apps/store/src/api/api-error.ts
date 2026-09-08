/**
 * A refusal from our own API, with the two things a caller can branch on.
 *
 * The body already carries `{ code, type, message }` — the code is an authored constant, never a
 * third party's string — and throwing a bare `Error` threw all of that away but the message. That
 * left the only way to recognise, say, a stale saved card as matching on copy, which breaks the
 * first time someone rewords it. `message` is unchanged, so every existing `error.message` toast
 * reads exactly as it did.
 *
 * Its own module and not `fetcher.ts`, because recognising a refusal and issuing a request are
 * different privileges: the fetcher belongs to the generated client alone and a rule enforces that,
 * while any code that catches an error may need to say which one it was.
 */
export class ApiError extends Error {
  readonly status: number
  /** The API's own code for this refusal, or `unknown_error` when the body carried none. */
  readonly code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/**
 * The refusal, read off the body where there is one.
 *
 * `no_json_body` is not filler: a 500 carrying our own envelope came from our server, and one with
 * an unparseable body came from something in front of it — a proxy, a load balancer. They are
 * different things to go and look at, and without the distinction the two log identically.
 */
export async function apiErrorFor(response: Response, request: string): Promise<ApiError> {
  const body: { message?: string; code?: string } | null = await response.json().catch(() => null)
  if (!body) return new ApiError(`${request} failed: ${response.status}`, response.status, 'no_json_body')

  return new ApiError(
    body.message ?? `${request} failed: ${response.status}`,
    response.status,
    body.code ?? 'unknown_error',
  )
}
