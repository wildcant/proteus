import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerOpenApiRoute } from '../src/core/openapi/register-route.js'
import { createRegistry, documentInfo, generateDocument } from '../src/core/openapi/registry.js'
import { adminDefinitions, storeDefinitions } from '../src/routes.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Admin API
const adminRegistry = createRegistry()
for (const definition of adminDefinitions) {
  registerOpenApiRoute(adminRegistry, definition.matcher, definition)
}

const adminDoc = generateDocument(adminRegistry, documentInfo.admin)
const adminPath = resolve(__dirname, '../openapi/openapi-admin.json')
writeFileSync(adminPath, `${JSON.stringify(adminDoc, null, 2)}\n`)
console.info(`Admin OpenAPI spec written to ${adminPath}`)

// Store API
const storeRegistry = createRegistry()
for (const definition of storeDefinitions) {
  registerOpenApiRoute(storeRegistry, definition.matcher, definition)
}

const storeDoc = generateDocument(storeRegistry, documentInfo.store)
const storePath = resolve(__dirname, '../openapi/openapi-store.json')
writeFileSync(storePath, `${JSON.stringify(storeDoc, null, 2)}\n`)
console.info(`Store OpenAPI spec written to ${storePath}`)
