import { resolve } from 'node:path'
import { test } from '@tests/setup/test-extend.js'
import { catalogConflicts, readCatalog, readCoreCatalog, readExtensionCatalogs } from '../extension-catalogs.js'

const FIXTURE_LOCALES = resolve(import.meta.dirname, '../../tests/extension-fixture/fixture/locales')

test('a message translated differently by two catalogs fails, and one translated alike passes', ({ expect }) => {
  const core = {
    source: 'core',
    messages: {
      en: { Hello: ['Hello'] },
      es: { Hello: ['Hola'], 'An internal error occurred': ['Ocurrió un error interno'] },
    },
  }
  const alpha = {
    source: 'extension "alpha"',
    messages: {
      es: { Hello: ['Hola'], 'An internal error occurred': ['Algo falló'], 'Name the city': ['Nombra la ciudad'] },
    },
  }
  const beta = { source: 'extension "beta"', messages: { es: { 'Name the city': ['Escribe la ciudad'] } } }

  expect(catalogConflicts([core, alpha, beta])).toEqual([
    'catalog conflict: "An internal error occurred" (es) is translated differently by core and extension "alpha"',
    'catalog conflict: "Name the city" (es) is translated differently by extension "alpha" and extension "beta"',
  ])
})

test("the fixture extension's compiled catalog reads and agrees with core's, and a folder without one reads none", async ({
  expect,
}) => {
  const extensions = await readExtensionCatalogs([{ name: 'fixture', directory: resolve(FIXTURE_LOCALES, '..') }])

  expect(extensions.map(({ source, messages }) => [source, Object.keys(messages).sort()])).toEqual([
    ['extension "fixture"', ['en', 'es']],
  ])
  expect(catalogConflicts([await readCoreCatalog(), ...extensions])).toEqual([])
  expect(await readCatalog(resolve(FIXTURE_LOCALES, 'missing'))).toBeUndefined()
})
