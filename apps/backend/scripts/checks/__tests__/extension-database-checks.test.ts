import { join } from 'node:path'
import { is } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'
import { describe, expect, test } from 'vitest'
import { productTable } from '../../../src/modules/product/models/product.js'
import { databaseNameViolations, migrationsTableViolations } from '../extension-database-names.js'
import { extensionForeignKeys } from '../extension-foreign-keys.js'
import type { Model } from '../types.js'
import * as fixture from './fixtures/extension-models.js'

const FIXTURES = join(import.meta.dirname, 'fixtures')
const FILE = 'scripts/checks/__tests__/fixtures/extension-models.ts'

/** The fixture's tables as the extension `acme-shop` would declare them, beside one core table. */
const models: Model[] = [
  ...Object.values(fixture).flatMap((value) =>
    is(value, PgTable) ? [{ module: 'acme-shop/notes', extension: 'acme-shop', file: FILE, table: value }] : [],
  ),
  { module: 'product', file: 'src/modules/product/models/product.ts', table: productTable },
]

describe('extension-database-names', () => {
  test('flags every unprefixed table, index, constraint and enum, and nothing prefixed or core', async () => {
    const messages = (await databaseNameViolations(models)).map((violation) => violation.message)

    expect(messages.sort()).toEqual(
      [
        `acme-shop's table "notes" does not start with "acme_shop_"`,
        `acme-shop's index "idx_notes_slug" does not start with "acme_shop_"`,
        `acme-shop's unique constraint "notes_kind_slug" does not start with "acme_shop_"`,
        `acme-shop's unique constraint "notes_slug_unique" does not start with "acme_shop_"`,
        `acme-shop's foreign key "notes_productId_product_id_fk" does not start with "acme_shop_"`,
        `acme-shop's enum "note_kind" does not start with "acme_shop_"`,
        `acme-shop's enum "stray_kind" does not start with "acme_shop_"`,
      ].sort(),
    )
  })

  test('each extension module records migrations in its own prefixed table, and has a config when it has models', () => {
    const module = (name: string, databaseConfig?: string) => ({
      extension: 'acme-shop',
      module: name,
      directory: join(FIXTURES, name),
      databaseConfig: databaseConfig && join(FIXTURES, databaseConfig),
    })

    const violations = migrationsTableViolations([
      module('notes', 'good.database.config.ts'),
      module('notes', 'unprefixed.database.config.ts'),
      module('orphan'),
      module('no-tables'),
    ])

    expect(violations.map((violation) => [violation.message, violation.remedy])).toEqual([
      [
        'scripts/checks/__tests__/fixtures/unprefixed.database.config.ts records migrations in "migrations_notes"',
        "set migrations: { table: 'migrations_acme_shop_notes' }",
      ],
      [
        "acme-shop's orphan module declares models but has no database.config.ts",
        "add database.config.ts beside its index.ts, with migrations: { table: 'migrations_acme_shop_orphan' }",
      ],
    ])
  })
})

describe('extension-foreign-keys', () => {
  test('flags a foreign key into core, and not one inside the extension', async () => {
    const violations = await extensionForeignKeys.run(models)

    expect(violations.map((violation) => violation.message)).toEqual(['notes.productId references core table product'])
  })
})
