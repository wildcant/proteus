#!/usr/bin/env node
/**
 * Refresh the inlined `shadcn/tailwind.css` block in src/styles.css.
 *
 * That block used to be an `@import` from the `shadcn` package. Depending on a CLI for one
 * stylesheet pulled 73 packages into both apps' graphs — including zod 3 and @dotenvx/dotenvx 1
 * against our own 4 and 2 — so `shadcn eject` inlined it and the dependency went away. The
 * trade, which is the CLI's own warning, is that the block no longer tracks upstream. This is how
 * you pick up a change to it.
 *
 *   pnpm --filter @proteus/ui run shadcn:re-eject          # latest
 *   pnpm --filter @proteus/ui run shadcn:re-eject 4.21.0   # a specific version
 *
 * Done by hand this is five steps in an order that matters, and `eject` refuses unless
 * `components.json` and the `@import` are in the same workspace — which is why the block lives
 * here rather than in either app. So: script.
 *
 * It rewrites src/shadcn.gen.css and the version pinned in the `shadcn:add` script, so the
 * components you scaffold come from the same release as the CSS that styles them. src/styles.css —
 * this package's own theme — keeps everything but its one `@import` line. The generated half lives
 * in its own file because `biome format` reformats CSS, and reformatting it would make every diff
 * against upstream unreadable; biome.json excludes `*.gen.css` for that reason.
 *
 * Unlike the original eject this IS a real upgrade, so finish by diffing the built CSS:
 *
 *   pnpm --filter admin run build && pnpm --filter store run build
 *
 * Byte-identical output means upstream changed nothing that reaches us. A diff is the thing worth
 * reading before committing.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const PACKAGE_ROOT = resolve(import.meta.dirname, '..')
const REPO_ROOT = resolve(PACKAGE_ROOT, '../..')
const STYLESHEET = join(PACKAGE_ROOT, 'src/styles.css')
const GENERATED = join(PACKAGE_ROOT, 'src/shadcn.gen.css')
const MANIFEST = join(PACKAGE_ROOT, 'package.json')
const LOCAL_IMPORT = '@import "./shadcn.gen.css";'
const PACKAGE_IMPORT = '@import "shadcn/tailwind.css";'

/** Only the two fields this script edits. Typing the rest would be inventing a package.json schema. */
type Manifest = {
  dependencies: Record<string, string>
  scripts: Record<string, string>
}

const version = process.argv[2] ?? 'latest'
const run = (command: string, args: string[], cwd: string): void => {
  execFileSync(command, args, { cwd, stdio: 'inherit', env: process.env })
}

const readManifest = (): Manifest => JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest
const writeManifest = (json: Manifest): void => writeFileSync(MANIFEST, `${JSON.stringify(json, null, 2)}\n`)

// 1. Point styles.css back at the package and hold this file's own two halves aside. The header is
//    withheld on purpose: `eject` writes its output at the TOP of the stylesheet rather than at the
//    position of the @import it replaces, so anything left above that import makes the boundary
//    between generated and hand-written CSS unfindable afterwards. Measured — an earlier version of
//    this script kept the header in place and sliced 1.1kB into the middle of the new CSS.
const original = readFileSync(STYLESHEET, 'utf8')
const importAt = original.indexOf(LOCAL_IMPORT)
if (importAt === -1) {
  console.info(`✖ src/styles.css does not contain ${LOCAL_IMPORT}.`)
  console.info('  That import is what marks where the generated CSS belongs. Restore it and re-run.')
  process.exit(1)
}
const header = original.slice(0, importAt)
const ownStyles = original.slice(importAt + LOCAL_IMPORT.length).replace(/^\n+/, '')
writeFileSync(STYLESHEET, `${PACKAGE_IMPORT}\n\n${ownStyles}`)

// 2. The CLI reads the version to stamp out of package.json, and removes the entry itself once it
//    has inlined the file. So the declaration is deliberately temporary.
const manifest = readManifest()
manifest.dependencies.shadcn = version === 'latest' ? 'latest' : `^${version}`
manifest.dependencies = Object.fromEntries(Object.entries(manifest.dependencies).sort(([a], [b]) => a.localeCompare(b)))
writeManifest(manifest)

console.info(`\n→ Installing shadcn@${version} so the CLI can be run from this workspace…`)
run('pnpm', ['install'], REPO_ROOT)
console.info('\n→ Ejecting…')
run('pnpm', ['exec', 'shadcn', 'eject', '-y'], PACKAGE_ROOT)

// 3. Split the result in two: the generated CSS into its own file, and styles.css back to the
//    header plus a one-line import of it. Everything the CLI left above this package's own styles
//    is the generated part, wherever it chose to put it.
const ejected = readFileSync(STYLESHEET, 'utf8')
const ownAt = ejected.indexOf(ownStyles)
if (ownAt === -1) {
  console.info("✖ Ejected, but this package's own styles could not be located afterwards.")
  console.info('  src/styles.css holds the new CSS and has NOT been split. Separate it by hand —')
  console.info(`  the generated half belongs in src/shadcn.gen.css, replaced here by ${LOCAL_IMPORT}`)
  process.exit(1)
}
const block = ejected.slice(0, ownAt).trimEnd()
const stamped = /ejected from shadcn@(\S+?)\s*\*\//.exec(block)?.[1]
writeFileSync(GENERATED, `${block}\n`)
writeFileSync(STYLESHEET, `${header}${LOCAL_IMPORT}\n\n${ownStyles}`)

// 4. Keep `shadcn:add` on the same release as the CSS, so a scaffolded component cannot reference a
//    variant this block does not define. `eject` has already dropped the dependency by now.
if (stamped && stamped !== 'unknown') {
  const updated = readManifest()
  updated.scripts['shadcn:add'] = `pnpm dlx shadcn@${stamped} add`
  writeManifest(updated)
  console.info(`\n→ Pinned shadcn:add to ${stamped}.`)
} else {
  console.info('\n! The CLI stamped no version, so shadcn:add was left alone. Check it by hand.')
}

console.info('\n→ Pruning shadcn back out of the tree…')
run('pnpm', ['install'], REPO_ROOT)

console.info(`\n✔ Re-ejected from shadcn@${stamped ?? version}.`)
console.info('  This is a real upgrade, so read the diff:')
console.info('    git diff packages/ui/src/shadcn.gen.css')
console.info('  and confirm what it does to the compiled output:')
console.info('    pnpm --filter admin run build && pnpm --filter store run build')
