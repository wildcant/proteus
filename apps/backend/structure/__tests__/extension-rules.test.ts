import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from '@tests/setup/test-extend.js'
import { cruise, type IConfiguration, type ICruiseResult } from 'dependency-cruiser'

/**
 * The extension rules of `structure/.dependency-cruiser.cjs`, run over a small backend written to a
 * temporary folder: one well-formed extension, then one break per rule. The fixture extension under
 * `tests/extension-fixture/` is the well-formed case `check:structure` runs on the real tree; this is
 * where each rule is shown to fire, since upstream has no extension to break.
 */

const configuration: IConfiguration = createRequire(import.meta.url)('../.dependency-cruiser.cjs')

let root: string

test.beforeEach(() => {
  // The real path: macOS's tmpdir is behind a symlink, and dependency-cruiser resolves through it, so
  // every import would otherwise land outside `baseDir` and match no rule.
  root = realpathSync(mkdtempSync(join(tmpdir(), 'structure-')))
  return () => rmSync(root, { recursive: true, force: true })
})

/**
 * A backend with one extension, `shop`, wired the way the generator wires one: the registries list
 * its module, route, hook handler and catalog, the workerd entry reaches the runtime registry, and
 * only the dev seed reads the seed registry. Imports are extensionless, since there is no tsconfig
 * here to map `.js` onto `.ts`.
 */
const wellFormed: Record<string, string> = {
  'src/core/types.ts': 'export type Context = { id: string }',
  'src/framework/types.ts': "import type { Context } from '../core/types'\nexport type Registry = Context",
  'src/workflows/cart/hooks.ts':
    "import type { Context } from '../../core/types'\nexport const chargesHook = {} as Context",
  'src/index.workerd.ts': "import { registry } from './extensions/registry.gen'\nexport default registry",
  'src/extensions/registry.gen.ts': [
    "import type { Registry } from '../framework/types'",
    "import notes from './shop/modules/notes/index'",
    "import routes from './shop/api/store/notes/definitions'",
    "import charges from './shop/hooks/charges'",
    "import { messages } from './shop/locales/en'",
    'export const registry = [notes, routes, charges, messages] as unknown as Registry',
  ].join('\n'),
  'src/extensions/seeds.gen.ts': [
    "import type { Registry } from '../framework/types'",
    "import seedNotes from './shop/seeds/notes'",
    'export const SEEDS = [seedNotes] as unknown as Registry',
  ].join('\n'),
  'scripts/seed-dev.ts': "import { SEEDS } from '../src/extensions/seeds.gen'\nexport default SEEDS",
  'src/extensions/shop/extension.ts': "export default { name: 'shop' }",
  'src/extensions/shop/keys.ts':
    "import type { Notes } from './types/notes'\nexport const ShopModules = { NOTES: 'shop.notes' as unknown as Notes }",
  'src/extensions/shop/types/notes.ts':
    "import type { Context } from '../../../core/types'\nexport type Notes = Context",
  'src/extensions/shop/schemas/notes.ts': 'export const NoteBody = {}',
  'src/extensions/shop/locales/en.ts': 'export const messages = {}',
  'src/extensions/shop/modules/notes/index.ts':
    "import { ShopModules } from '../../keys'\nimport { NotesService } from './services/notes'\nexport default [ShopModules.NOTES, NotesService]",
  'src/extensions/shop/modules/notes/services/notes.ts':
    "import type { Notes } from '../../../types/notes'\nexport class NotesService { notes?: Notes }",
  'src/extensions/shop/modules/notes/__tests__/notes.test.ts':
    "import { NotesService } from '../services/notes'\nexport const service = new NotesService()",
  'src/extensions/shop/api/store/notes/definitions.ts': "import * as notes from './route'\nexport default [notes]",
  'src/extensions/shop/api/store/notes/route.ts': [
    "import type { Registry } from '../../../../../framework/types'",
    "import { ShopModules } from '../../../keys'",
    "import { NoteBody } from '../../../schemas/notes'",
    "import { createNote } from '../../../workflows/create-note'",
    'export const GET = [ShopModules, NoteBody, createNote] as unknown as Registry',
  ].join('\n'),
  'src/extensions/shop/workflows/create-note.ts':
    "import { ShopModules } from '../keys'\nexport const createNote = ShopModules",
  'src/extensions/shop/hooks/charges.ts':
    "import { chargesHook } from '../../../workflows/cart/hooks'\nexport default chargesHook",
  // A seed may read files: only the dev seed reaches it.
  'src/extensions/shop/seeds/notes.ts':
    "import { readFileSync } from 'node:fs'\nimport { ShopModules } from '../keys'\nexport default () => [readFileSync, ShopModules]",
}

/** Every violation the tree raises, as `rule: from` and sorted, so an extra one fails the assertion too. */
async function violations(files: Record<string, string>): Promise<string[]> {
  for (const [path, content] of Object.entries({ ...wellFormed, ...files })) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  const { output } = await cruise(['src', 'scripts'], {
    baseDir: root,
    validate: true,
    ruleSet: { forbidden: configuration.forbidden, required: configuration.required },
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
  })
  const result = output as ICruiseResult
  return result.summary.violations.map(({ rule, from }) => `${rule.name}: ${from}`).sort()
}

test.describe('the extension structure rules', () => {
  test('a well-formed extension raises nothing', async ({ expect }) => {
    expect(await violations({})).toEqual([])
  })

  test('an extension may not import another', async ({ expect }) => {
    expect(
      await violations({
        'src/extensions/other/types/notes.ts':
          "import type { Notes } from '../../shop/types/notes'\nexport type Mine = Notes",
      }),
    ).toEqual(['no-imports-between-extensions: src/extensions/other/types/notes.ts'])
  })

  test('an extension file the workerd entry reaches may not reach the file system', async ({ expect }) => {
    expect(
      await violations({
        // Transitively: the workflow imports a helper that reads the disk, so the route that runs the
        // workflow reaches it as well, and each is named.
        'src/extensions/shop/workflows/create-note.ts':
          "import { ShopModules } from '../keys'\nimport { read } from './read'\nexport const createNote = [ShopModules, read]",
        'src/extensions/shop/workflows/read.ts': "import { readFile } from 'fs/promises'\nexport const read = readFile",
      }),
    ).toEqual([
      'no-file-system-in-workerd-extensions: src/extensions/shop/api/store/notes/definitions.ts',
      'no-file-system-in-workerd-extensions: src/extensions/shop/api/store/notes/route.ts',
      'no-file-system-in-workerd-extensions: src/extensions/shop/workflows/create-note.ts',
      'no-file-system-in-workerd-extensions: src/extensions/shop/workflows/read.ts',
    ])
  })

  test('nothing under src/ may import the seed registry', async ({ expect }) => {
    expect(
      await violations({
        'src/framework/seeds.ts': "import { SEEDS } from '../extensions/seeds.gen'\nexport const seeds = SEEDS",
      }),
    ).toEqual([
      'layer-graph-framework: src/framework/seeds.ts',
      'seed-registry-only-from-the-dev-seed: src/framework/seeds.ts',
    ])
  })

  test('an extension module may not import a sibling module', async ({ expect }) => {
    expect(
      await violations({
        'src/extensions/shop/modules/tags/index.ts':
          "import { NotesService } from '../notes/services/notes'\nexport default NotesService",
      }),
    ).toEqual(['no-cross-extension-module-imports: src/extensions/shop/modules/tags/index.ts'])
  })

  test('an extension layer imports only what its row allows', async ({ expect }) => {
    expect(
      await violations({
        // A contract that names a workflow, and a module that reaches a core module.
        'src/extensions/shop/types/leak.ts':
          "import { createNote } from '../workflows/create-note'\nexport const w = createNote",
        'src/modules/cart/index.ts': 'export default {}',
        'src/extensions/shop/modules/notes/utils/cart.ts':
          "import cart from '../../../../../modules/cart/index'\nexport const c = cart",
      }),
    ).toEqual([
      'layer-graph-extensionModules: src/extensions/shop/modules/notes/utils/cart.ts',
      'layer-graph-extensionTypes: src/extensions/shop/types/leak.ts',
    ])
  })

  test('the extensions folder and each extension hold only their known entries', async ({ expect }) => {
    expect(
      await violations({
        'src/extensions/helpers.ts': 'export const helper = 1',
        'src/extensions/shop/utils/helper.ts': 'export const helper = 1',
        'src/extensions/shop/api/store/notes/helper.ts': 'export const helper = 1',
        'src/extensions/shop/api/admin/notes/route.ts': 'export const GET = 1',
        'src/extensions/shop/modules/notes/helper.ts': 'export const helper = 1',
        'src/extensions/shop/modules/notes/providers/gateway.ts': 'export const gateway = 1',
        'src/extensions/shop/modules/notes/services/notes.test.ts': 'export const misplaced = 1',
      }),
    ).toEqual([
      'extension-api-holds-only-four-file-kinds: src/extensions/shop/api/admin/notes/route.ts',
      'extension-api-holds-only-four-file-kinds: src/extensions/shop/api/store/notes/helper.ts',
      'extension-holds-only-known-entries: src/extensions/shop/utils/helper.ts',
      'extension-module-holds-only-known-file-kinds: src/extensions/shop/modules/notes/helper.ts',
      'extension-module-holds-only-known-file-kinds: src/extensions/shop/modules/notes/providers/gateway.ts',
      'extension-module-tests-live-in-a-tests-folder: src/extensions/shop/modules/notes/services/notes.test.ts',
      'extensions-holds-registries-and-extensions: src/extensions/helpers.ts',
    ])
  })
})
