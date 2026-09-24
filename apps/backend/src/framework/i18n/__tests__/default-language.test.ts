import { noopLogger } from '@core/logger/noop-logger.js'
import { describe, expect, it, vi } from 'vitest'
import { createDefaultLanguage } from '../default-language.js'

const clock = () => {
  let time = 0
  return {
    now: () => time,
    advance: (ms: number) => {
      time += ms
    },
  }
}

describe('createDefaultLanguage', () => {
  it('answers the first request on a cold instance in the default market language', async () => {
    const load = vi.fn(async () => 'es-CO')
    const defaultLanguage = createDefaultLanguage({ load, logger: noopLogger })

    expect(await defaultLanguage.get()).toBe('es')
    expect(await defaultLanguage.get()).toBe('es')
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('collapses concurrent cold reads into one load, all answered in the default market language', async () => {
    const load = vi.fn(async () => 'es-CO')
    const defaultLanguage = createDefaultLanguage({ load, logger: noopLogger })

    expect(await Promise.all([defaultLanguage.get(), defaultLanguage.get()])).toEqual(['es', 'es'])
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('answers English when the first read fails', async () => {
    const load = vi.fn(async () => {
      throw new Error('db down')
    })
    const defaultLanguage = createDefaultLanguage({ load, logger: noopLogger })

    expect(await defaultLanguage.get()).toBe('en')
  })

  it('serves the held language while a stale entry refreshes', async () => {
    const { now, advance } = clock()
    const load = vi.fn<() => Promise<string | null>>().mockResolvedValueOnce('es-CO').mockResolvedValueOnce('en-US')
    const defaultLanguage = createDefaultLanguage({ load, logger: noopLogger, now })
    await defaultLanguage.refresh()

    advance(5 * 60 * 1000)
    expect(await defaultLanguage.get()).toBe('es')
    await defaultLanguage.refresh()

    expect(await defaultLanguage.get()).toBe('en')
  })

  it('keeps the held language when a read fails, and English when the store names no market', async () => {
    const { now, advance } = clock()
    const load = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValueOnce('es-CO')
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce(null)
    const defaultLanguage = createDefaultLanguage({ load, logger: noopLogger, now })
    await defaultLanguage.refresh()

    advance(5 * 60 * 1000)
    await defaultLanguage.refresh()
    expect(await defaultLanguage.get()).toBe('es')

    advance(30 * 1000)
    await defaultLanguage.refresh()
    expect(await defaultLanguage.get()).toBe('en')
  })
})
