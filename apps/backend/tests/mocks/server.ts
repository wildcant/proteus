import { setupServer } from 'msw/node'
import { startFakeGatewayServer } from './fake-gateway-server.js'
import { handlers } from './handlers.js'
import { onUnhandledRequest } from './on-unhandled-request.js'

export const server = setupServer(...handlers)
export { onUnhandledRequest, startFakeGatewayServer }
