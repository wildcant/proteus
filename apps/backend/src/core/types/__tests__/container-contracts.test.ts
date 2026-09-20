import { expect, test } from 'vitest'
import { ContainerRegistrationKeys } from '../../utils/container.js'
import { Modules } from '../../utils/modules-definition.js'
import type { AppContainer, ModuleContainer } from '../container.js'
import type { IOrderModuleService } from '../order/service.js'

/**
 * These assertions are made by `tsc`, not by the runtime: each `@ts-expect-error` fails
 * `pnpm run typecheck` the moment the line below it stops being an error, which is what happens
 * if `AppContainer` loses the key-to-contract mapping and `resolve` goes back to returning what
 * the call site asked for. The bodies never run — a `resolve` off a declared-only container would
 * throw — so the test itself only asserts they compiled.
 */
test('a container read is typed by the key it was given', () => {
  function moduleServices(container: AppContainer) {
    const orderService = container.resolve(Modules.ORDER)
    void orderService.listOrders({})
    // @ts-expect-error - the order service has no such method, and the key says which service it is
    void orderService.listOrdersByMood()

    const productService = container.resolve(Modules.PRODUCT)
    // @ts-expect-error - `listOrders` belongs to a different key's contract
    void productService.listOrders({})
  }

  function coreRegistrations(container: AppContainer) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    void logger.info('resolved')
    // @ts-expect-error - the logger port has no `warning`; it has `warn`
    void logger.warning('resolved')

    const linkService = container.resolve(ContainerRegistrationKeys.LINK)
    // @ts-expect-error - a link service is not an event bus, whatever the caller was hoping for
    void linkService.emit('order.placed')
  }

  expect([moduleServices, coreRegistrations].every((check) => typeof check === 'function')).toBe(true)
})

test('a shared-container read cannot be typed by hand', () => {
  function overrides(container: AppContainer) {
    // @ts-expect-error - the type argument is the key, so another module's contract is not one
    void container.resolve<IOrderModuleService>(Modules.PRODUCT)
    // @ts-expect-error - and neither is a type written at the call site
    void container.resolve<{ listGrantedPermissionKeys(): Promise<string[]> }>(Modules.ACCESS_CONTROL)
  }

  // A module's private container is the one that still takes a type argument, for the repositories
  // and provider instances it registered under keys `core/` has never seen.
  function privateKeys(container: ModuleContainer) {
    void container.resolve<{ find(): Promise<unknown[]> }>('notificationProviderRepository')
    void container.resolve(ContainerRegistrationKeys.LOGGER)
  }

  expect([overrides, privateKeys].every((check) => typeof check === 'function')).toBe(true)
})
