import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { getTableConfig, isPgEnum } from 'drizzle-orm/pg-core'
import * as ts from 'typescript'
import type { ExtensionModule } from '../extension-modules.js'
import { EXTENSIONS_ROOT, extensionModules, FIXTURE_EXTENSIONS_ROOT } from '../extension-modules.js'
import { databasePrefix } from '../extension-names.js'
import { BACKEND } from '../runtime-sources.js'
import { parse } from '../ts-source.js'
import { locate } from './metadata.js'
import type { Check, Model, Violation } from './types.js'

/**
 * Postgres has one namespace per schema for tables, indexes, constraints and types, and drizzle
 * keeps one migrations table per config. A fork's extension writes into all of them beside core,
 * so a name core adds in a later release could land on one the extension already took — and the
 * merge that brings it in is clean, because the two names live in different files. The failure is
 * a migration that will not apply. Every extension database name carries the extension's snake
 * prefix (`pisos_dj_`), which core never starts a name with.
 */
export const extensionDatabaseNames: Check = {
  name: 'extension-database-names',
  rule: "every table, index, constraint, enum and migrations table an extension declares starts with the extension's snake prefix",
  run: async (models) => [
    ...(await databaseNameViolations(models)),
    ...migrationsTableViolations([...extensionModules(EXTENSIONS_ROOT), ...extensionModules(FIXTURE_EXTENSIONS_ROOT)]),
  ],
}

/** The name of every database object an extension model creates, beside the prefix it needs. */
export async function databaseNameViolations(models: Model[]): Promise<Violation[]> {
  const violations: Violation[] = []
  const columnEnums = new Set<string>()

  for (const { extension, file, table } of models) {
    if (!extension) continue
    const prefix = databasePrefix(extension)
    const config = getTableConfig(table)

    const names: { kind: string; name: string | undefined }[] = [
      { kind: 'table', name: config.name },
      ...config.indexes.flatMap((index) => (index.config.name ? [{ kind: 'index', name: index.config.name }] : [])),
      ...config.uniqueConstraints.map((constraint) => ({ kind: 'unique constraint', name: constraint.getName() })),
      ...config.checks.map((check) => ({ kind: 'check constraint', name: check.name })),
      ...config.foreignKeys.map((key) => ({ kind: 'foreign key', name: key.getName() })),
      ...config.primaryKeys.map((key) => ({ kind: 'primary key', name: key.getName() })),
      ...config.columns.flatMap((column) =>
        column.isUnique && column.uniqueName ? [{ kind: 'unique constraint', name: column.uniqueName }] : [],
      ),
      ...config.columns.flatMap((column) => {
        const enumName = enumOf(column)
        return enumName ? [{ kind: 'enum', name: enumName }] : []
      }),
    ]

    for (const { kind, name } of names) if (kind === 'enum' && name) columnEnums.add(name)

    for (const { kind, name } of names) {
      // An unnamed object takes drizzle's default name, which starts with the table's.
      if (!name || name.startsWith(prefix)) continue
      violations.push({
        location: locate(file, name),
        message: `${extension}'s ${kind} "${name}" does not start with "${prefix}"`,
        remedy: `rename it to "${prefix}${name}" or another name starting with "${prefix}"`,
      })
    }
  }

  // An exported enum no column uses still becomes a type in the migration.
  for (const { extension, file } of uniqueFiles(models)) {
    const prefix = databasePrefix(extension)
    const exports: Record<string, unknown> = await import(pathToFileURL(join(BACKEND, file)).href)
    for (const value of Object.values(exports)) {
      if (!isPgEnum(value) || value.enumName.startsWith(prefix) || columnEnums.has(value.enumName)) continue
      violations.push({
        location: locate(file, value.enumName),
        message: `${extension}'s enum "${value.enumName}" does not start with "${prefix}"`,
        remedy: `rename it to "${prefix}${value.enumName}"`,
      })
    }
  }

  return violations
}

/**
 * Each extension module with tables names its own migrations table, `migrations_<prefix><module>`.
 * A module with models and no config is never migrated, which reads as a missing table at runtime.
 */
export function migrationsTableViolations(modules: ExtensionModule[]): Violation[] {
  const violations: Violation[] = []

  for (const { extension, module, directory, databaseConfig } of modules) {
    const expected = `migrations_${databasePrefix(extension)}${module.replaceAll('-', '_')}`

    if (!databaseConfig) {
      if (!hasModels(directory)) continue
      violations.push({
        location: relative(BACKEND, directory),
        message: `${extension}'s ${module} module declares models but has no database.config.ts`,
        remedy: `add database.config.ts beside its index.ts, with migrations: { table: '${expected}' }`,
      })
      continue
    }

    const file = relative(BACKEND, databaseConfig)
    const table = migrationsTableIn(databaseConfig)
    if (table === expected) continue

    violations.push({
      location: table ? locate(file, table) : file,
      message: table
        ? `${file} records migrations in "${table}"`
        : `${file} names no migrations table, so drizzle records it in the shared default`,
      remedy: `set migrations: { table: '${expected}' }`,
    })
  }

  return violations
}

function enumOf(column: unknown): string | undefined {
  if (typeof column !== 'object' || column === null || !('enum' in column)) return undefined
  return isPgEnum(column.enum) ? column.enum.enumName : undefined
}

function uniqueFiles(models: Model[]): { extension: string; file: string }[] {
  const files = new Map<string, string>()
  for (const { extension, file } of models) if (extension) files.set(file, extension)
  return [...files].map(([file, extension]) => ({ extension, file }))
}

function hasModels(directory: string): boolean {
  try {
    return readdirSync(join(directory, 'models')).some((name) => name.endsWith('.ts'))
  } catch {
    return false
  }
}

/** The string literal at `migrations: { table: '…' }`, read from syntax so env is never loaded. */
function migrationsTableIn(path: string): string | undefined {
  const source = parse({ path, source: readFileSync(path, 'utf8') })
  let table: string | undefined

  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'migrations' &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const property of node.initializer.properties) {
        if (
          ts.isPropertyAssignment(property) &&
          ts.isIdentifier(property.name) &&
          property.name.text === 'table' &&
          ts.isStringLiteralLike(property.initializer)
        ) {
          table = property.initializer.text
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  return table
}
