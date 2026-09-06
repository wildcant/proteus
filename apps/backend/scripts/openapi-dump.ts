import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerOpenApiRoute } from '../src/core/openapi/register-route.js'
import { createRegistry, documentInfo, generateDocument } from '../src/core/openapi/registry.js'
import { adminDefinitions, storeDefinitions } from '../src/routes.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// `--out-dir` exists for the pre-commit drift check, which dumps into a temp directory and
// diffs against the committed pair. A hook that wrote into the working tree would stage
// changes the developer never wrote. Relative paths resolve against the caller's cwd.
const outDirFlag = process.argv.indexOf('--out-dir')
const requestedOutDir = outDirFlag === -1 ? undefined : process.argv[outDirFlag + 1]
// Without this, `--out-dir` with no value falls through to the default and writes into the
// working tree — the one thing the pre-commit hook must never do.
if (outDirFlag !== -1 && !requestedOutDir) {
  throw new Error('--out-dir requires a directory')
}
const outDir = requestedOutDir ? resolve(requestedOutDir) : resolve(__dirname, '../openapi')

// Admin API
const adminRegistry = createRegistry()
for (const definition of adminDefinitions) {
  registerOpenApiRoute(adminRegistry, definition.matcher, definition)
}

const adminDoc = generateDocument(adminRegistry, documentInfo.admin)
const adminPath = resolve(outDir, 'openapi-admin.json')
writeFileSync(adminPath, `${JSON.stringify(adminDoc, null, 2)}\n`)
console.info(`Admin OpenAPI spec written to ${adminPath}`)

// Store API
const storeRegistry = createRegistry()
for (const definition of storeDefinitions) {
  registerOpenApiRoute(storeRegistry, definition.matcher, definition)
}

const storeDoc = generateDocument(storeRegistry, documentInfo.store)
const storePath = resolve(outDir, 'openapi-store.json')
writeFileSync(storePath, `${JSON.stringify(storeDoc, null, 2)}\n`)
console.info(`Store OpenAPI spec written to ${storePath}`)
