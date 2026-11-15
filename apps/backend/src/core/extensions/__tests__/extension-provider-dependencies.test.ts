import { asValue, createContainer } from 'awilix'
import { describe, expect, it } from 'vitest'
import { ContainerRegistrationKeys } from '../../utils/container.js'
import { Modules } from '../../utils/modules-definition.js'
import { extensionProviderDependencies } from '../extension.js'
import { defineModuleKey } from '../module-key.js'

describe('extensionProviderDependencies', () => {
  it('resolves module services and refuses every other registration on the shared container', () => {
    const rates = { findRateForCity: () => null }
    const store = { retrieveStore: () => null }
    const Rates = defineModuleKey<typeof rates>('fixture.shipping-rates')
    const container = createContainer()
    container.register({
      [Rates]: asValue(rates),
      [Modules.STORE]: asValue(store),
      [ContainerRegistrationKeys.GET_DB]: asValue(() => 'db'),
      [ContainerRegistrationKeys.LOGGER]: asValue({}),
    })

    const { resolve } = extensionProviderDependencies(container)

    expect(resolve(Rates)).toBe(rates)
    expect(resolve(Modules.STORE)).toBe(store)
    // Neither compiles either: the type answers module keys only.
    // @ts-expect-error the database is not a module service
    expect(() => resolve(ContainerRegistrationKeys.GET_DB)).toThrow('module services only, not "__get_db__"')
    // @ts-expect-error the logger is not a module service
    expect(() => resolve(ContainerRegistrationKeys.LOGGER)).toThrow('not "logger"')
  })
})
