#!/usr/bin/env node
/**
 * One version of each dependency.
 *
 * The claim:
 *
 *   A package that a workspace declares is installed at one version.
 *
 * If any manifest in this repo names a package, `pnpm-lock.yaml` resolves it to exactly one
 * version. Packages nobody declares are deliberately out of scope: the repo has no opinion about
 * them, and over a hundred are duplicated for reasons that live in other people's dependency trees.
 *
 * Why this is worth a gate rather than a one-time cleanup. Under npm's hoisted layout one copy of
 * each package won and nobody had to think about it. Under pnpm two copies really are two copies,
 * and a split has three different causes needing three different fixes:
 *
 *   - workspaces declare it and disagree      -> the `catalog:` in pnpm-workspace.yaml
 *   - workspaces agree and it splits anyway   -> `overrides:` in pnpm-workspace.yaml
 *   - nobody declares it                      -> nothing, and nothing needs to
 *
 * The second is the one that broke the build: `@tanstack/react-form` pins `@tanstack/form-core`
 * to an exact version while we declare a caret, so a third party's manifest produced two copies
 * and TypeScript treated their types as unrelated — 21 errors in apps/admin. For a type-only
 * library that is a compile error. For anything holding module state it would be a runtime one.
 *
 * Why it has to read the lockfile. That is the only artefact that knows what was actually
 * resolved. syncpack and manypkg compare manifests, and both report zero rows for exactly the
 * packages that are split, because the manifests agree and the disagreement is downstream.
 *
 * Why it is a script and not a rule: no rule engine here reads a lockfile. dependency-cruiser,
 * Biome and ast-grep all read source, and `.dependency-cruiser.cjs` has no vocabulary for
 * "resolved version". standards/README.md records that verdict.
 *
 * `.mts`, and run by `node` directly rather than through tsx: the root package.json has no
 * `"type": "module"`, so node reparses an ESM `.ts` in a CommonJS scope and warns on every run.
 * Nothing here needs a transform, only type erasure, which keeps this check what it claims to be —
 * offline, no dependency, ~40ms. The root tsconfig.json sets `erasableSyntaxOnly` so a construct
 * node cannot strip fails typecheck rather than at runtime.
 *
 * FORMAT DEPENDENCY: this parses `pnpm-lock.yaml` with a regex and targets `lockfileVersion: '9.0'`
 * (pnpm 10). The supported alternative, `pnpm list -r --depth Infinity --json`, emits ~118 MB here
 * and takes about a second; the regex is the better trade at this size. But a lockfile layout
 * change would most likely make this check find *nothing*, which is the failure direction that
 * does not announce itself — a clean tree and a broken gate print the same line. So on every pnpm
 * major: drop the `@tanstack/form-core` override from pnpm-workspace.yaml, `rm -rf node_modules`,
 * reinstall, and confirm this reports the split and exits 1. Then restore. If it stays green, the
 * parse has stopped matching.
 */
import { existsSync, globSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO_ROOT = resolve(import.meta.dirname, '../..')
const LOCKFILE = join(REPO_ROOT, 'pnpm-lock.yaml')
const TARGET_LOCKFILE_VERSION = '9.0'

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const

type DependencyField = (typeof DEPENDENCY_FIELDS)[number]
type Manifest = Partial<Record<DependencyField, Record<string, string>>>
type Violation = { name: string; installed: string[]; sites: string[] }

/**
 * Splits with no fix available, each keyed to the reason. The value is the reason rather than
 * `true` so an entry cannot be added silently, and each one has to name the packages that
 * disagree — otherwise "accepted" decays into "not looked at".
 */
const accepted: Record<string, string> = {
  '@types/node':
    "every workspace declares 22. Both copies of 24 sit under @temporalio, which apps/backend requires: protobufjs 7.6.6 via @grpc/proto-loader (the gRPC transport to the Temporal server) and jest-worker 27.5.1 via webpack, which @temporalio/worker takes as a hard dependency to bundle src/workflows into its deterministic isolate. Both take @types/node as a hard dependency, not a peer, so no declaration of ours reaches them. An override would, but forcing node types onto Temporal's bundler is a worse trade than a type-only duplicate we never compile against.",
}

const RED = '\x1b[0;31m'
const GREEN = '\x1b[0;32m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

/** Reads the top-level YAML key a line opens, or null when the line is not a top-level key. */
const topLevelKey = (line: string): string | null => (/^[a-zA-Z]/.test(line) ? (line.split(':')[0] ?? null) : null)

const record = (versions: Map<string, Set<string>>, name: string, version: string): void => {
  const already = versions.get(name)
  if (already) {
    already.add(version)
    return
  }
  versions.set(name, new Set([version]))
}

/** Every version the lockfile resolved, per package name. */
function resolvedVersions(): Map<string, Set<string>> {
  const lockfile = readFileSync(LOCKFILE, 'utf8')

  const declaredVersion = /^lockfileVersion: '([^']+)'/m.exec(lockfile)?.[1]
  if (declaredVersion !== TARGET_LOCKFILE_VERSION) {
    console.info(
      `${RED}✖${RESET} pnpm-lock.yaml is lockfileVersion '${declaredVersion}', but this check parses '${TARGET_LOCKFILE_VERSION}'.`,
    )
    console.info('  Re-read the FORMAT DEPENDENCY note at the top of this file before touching it.')
    process.exit(1)
  }

  const versions = new Map<string, Set<string>>()
  let inPackages = false
  for (const line of lockfile.split('\n')) {
    // Top-level keys are the only unindented lines, so they are what opens and closes a section.
    const key = topLevelKey(line)
    if (key !== null) inPackages = key === 'packages'
    if (!inPackages) continue
    // `  name@version:` or `  'name@version':`, where a peer-suffixed key carries a trailing
    // `(peer@x)` that is not part of the version.
    const match = /^ {2}'?((?:@[^/]+\/)?[^@'\s]+)@([^'\s(:]+)/.exec(line)
    if (!match) continue
    const [, name, version] = match
    if (name === undefined || version === undefined) continue
    record(versions, name, version)
  }
  return versions
}

/**
 * Every package any manifest declares, and where. Derived from pnpm-workspace.yaml's own
 * `packages:` globs, so neither a new workspace nor a new dependency needs an edit here.
 */
function declarations(): Map<string, string[]> {
  const workspaceYaml = readFileSync(join(REPO_ROOT, 'pnpm-workspace.yaml'), 'utf8')
  const globs: string[] = []
  let inPackages = false
  for (const line of workspaceYaml.split('\n')) {
    const key = topLevelKey(line)
    if (key !== null) inPackages = key === 'packages'
    if (!inPackages) continue
    const match = /^ {2}- '?([^'\s]+)'?/.exec(line)
    const glob = match?.[1]
    if (glob !== undefined) globs.push(glob)
  }

  const manifests = ['package.json']
  for (const glob of globs) {
    manifests.push(...globSync(`${glob}/package.json`, { cwd: REPO_ROOT }))
  }

  const declared = new Map<string, string[]>()
  for (const manifest of manifests) {
    const json = JSON.parse(readFileSync(join(REPO_ROOT, manifest), 'utf8')) as Manifest
    for (const field of DEPENDENCY_FIELDS) {
      for (const name of Object.keys(json[field] ?? {})) {
        const sites = declared.get(name)
        if (sites) sites.push(`${manifest} (${field})`)
        else declared.set(name, [`${manifest} (${field})`])
      }
    }
  }
  return declared
}

if (!existsSync(LOCKFILE)) {
  console.info(`${RED}✖${RESET} No pnpm-lock.yaml at the repo root. Run ${BOLD}pnpm install${RESET} first.`)
  process.exit(1)
}

const versions = resolvedVersions()
const declared = declarations()

const violations: Violation[] = []
for (const [name, sites] of declared) {
  const installed = versions.get(name)
  // A workspace package is linked, not resolved, so it never appears in `packages:`.
  if (!installed || installed.size < 2) continue
  if (name in accepted) continue
  violations.push({ name, installed: [...installed].sort(), sites })
}

if (violations.length === 0) {
  console.info(`${GREEN}✔${RESET} every declared package resolves to one version`)
  console.info(
    `${DIM}  ${declared.size} declared, ${versions.size} resolved, ${Object.keys(accepted).length} accepted split(s)${RESET}`,
  )
  process.exit(0)
}

for (const { name, installed, sites } of violations) {
  console.info(`${RED}✖${RESET} ${BOLD}${name}${RESET} is installed at ${installed.join(', ')}`)
  for (const site of sites) console.info(`${DIM}    declared by ${site}${RESET}`)
  console.info(`${DIM}    run: pnpm why -r ${name}${RESET}`)
}

console.info('')
console.info(`${RED}✖${RESET} ${violations.length} declared package(s) installed at more than one version`)
console.info('')
console.info(
  `  If the manifests ${BOLD}disagree${RESET}, the fix is the ${BOLD}catalog:${RESET} in pnpm-workspace.yaml.`,
)
console.info(
  `  If they ${BOLD}agree${RESET} and it splits anyway, a third party pinned it — the fix is ${BOLD}overrides:${RESET},`,
)
console.info('  at an exact version, followed by `rm -rf node_modules && pnpm install`. Not a lockfile delete.')
console.info(`  If it genuinely cannot be collapsed, add it to ${BOLD}accepted${RESET} in this file with a reason.`)
console.info('')
process.exit(1)
