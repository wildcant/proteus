import { setupServer } from 'msw/node'
import { handlers } from './handlers/index.js'
import { onUnhandledRequest } from './on-unhandled-request.js'

/**
 * MSW for the backend process — the third-party calls the server itself makes.
 *
 * Started only under `MOCKS=true`, which is the e2e server and nothing else.
 */
export const server = setupServer(...handlers)
export { onUnhandledRequest }
