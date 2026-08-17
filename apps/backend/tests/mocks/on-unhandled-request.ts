import type { UnhandledRequestStrategy } from 'msw'

const knownServices: Record<string, string> = {
  'api.resend.com': 'Resend',
}

const passthroughHosts = new Set(['localhost', '127.0.0.1'])

export const onUnhandledRequest: UnhandledRequestStrategy = (request) => {
  const { hostname } = new URL(request.url)

  if (passthroughHosts.has(hostname)) return

  const serviceName = knownServices[hostname] ?? hostname
  throw new Error(
    `[MSW] Unhandled outbound request to ${serviceName}: ${request.method} ${request.url}. ` +
      'Add an MSW handler or update the passthrough list if this is intentional.',
  )
}
