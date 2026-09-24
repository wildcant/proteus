/**
 * `@tanstack/react-start` and `@tanstack/react-start/server`, as the client bundle sees them, for
 * the browser test project.
 *
 * `api/fetcher.ts` reaches both through `currentUrl()`. In the app, Start's Vite plugin rewrites
 * an isomorphic function to its `.client()` half and drops the server imports from the client
 * bundle; the browser project runs without Start, so the real modules would pull Start's server
 * core — `node:async_hooks` included — into Chromium and no test file would load. A component test
 * is always the client, so this does what the plugin does: keep `.client()`, never call `.server()`.
 */

type AnyFn = (...args: never[]) => unknown

type IsomorphicFn = AnyFn & { server: (fn: AnyFn) => IsomorphicFn; client: (fn: AnyFn) => IsomorphicFn }

export function createIsomorphicFn(): IsomorphicFn {
  let clientHalf: AnyFn = () => undefined
  const isomorphic = ((...args: never[]) => clientHalf(...args)) as IsomorphicFn
  isomorphic.server = () => isomorphic
  isomorphic.client = (fn) => {
    clientHalf = fn
    return isomorphic
  }
  return isomorphic
}

export function getRequest(): Request {
  throw new Error('getRequest() is server-only; a browser component test has no request')
}
