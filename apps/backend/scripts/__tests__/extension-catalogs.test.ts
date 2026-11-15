import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { catalogConflicts, readCatalog, readCoreCatalog, readExtensionCatalogs } from '../extension-catalogs.js'

const FIXTURE_LOCALES = resolve(import.meta.dirname, '../../tests/extension-fixture/fixture/locales')

describe('catalogConflicts', () => {
  it('fails a message an extension translates differently from core, or from another extension', () => {
    const core = { source: 'core', messages: { es: { 'An internal error occurred': ['Ocurrió un error interno'] } } }
    const alpha = {
      source: 'extension "alpha"',
      messages: { es: { 'An internal error occurred': ['Algo falló'], 'Name the city': ['Nombra la ciudad'] } },
    }
    const beta = { source: 'extension "beta"', messages: { es: { 'Name the city': ['Escribe la ciudad'] } } }

    expect(catalogConflicts([core, alpha, beta])).toEqual([
      'catalog conflict: "An internal error occurred" (es) is translated differently by core and extension "alpha"',
      'catalog conflict: "Name the city" (es) is translated differently by extension "alpha" and extension "beta"',
    ])
  })

  it('passes a message two catalogs translate alike, and one id in two languages', () => {
    const core = { source: 'core', messages: { en: { Hello: ['Hello'] }, es: { Hello: ['Hola'] } } }
    const alpha = { source: 'extension "alpha"', messages: { es: { Hello: ['Hola'] } } }

    expect(catalogConflicts([core, alpha])).toEqual([])
  })

  it("passes the fixture extension's compiled catalog against core's", async () => {
    const extensions = await readExtensionCatalogs([{ name: 'fixture', directory: resolve(FIXTURE_LOCALES, '..') }])

    expect(extensions.map(({ source, messages }) => [source, Object.keys(messages).sort()])).toEqual([
      ['extension "fixture"', ['en', 'es']],
    ])
    expect(catalogConflicts([await readCoreCatalog(), ...extensions])).toEqual([])
  })

  it('reads no catalog from a folder without one', async () => {
    expect(await readCatalog(resolve(FIXTURE_LOCALES, 'missing'))).toBeUndefined()
  })
})
