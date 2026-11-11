import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as previewRoutes from './preview/route.js'
import * as structureRoutes from './route.js'

export default [
  {
    method: 'POST',
    matcher: '/admin/catalog-structure/preview',
    handler: previewRoutes.POST,
    input: previewRoutes.PostInput,
    permissions: ['product.read'],
    operationId: 'previewCatalogStructure',
    summary: 'Preview a structure file',
    description:
      'Reads an uploaded structure file (`estructura.yaml`: categorias, colecciones, menu) and answers with the Categories and Collections it would create, update, move and delete, and the menu before and after. Every error carries its path in the file. Writes nothing.',
    tags: [Tags.PRODUCTS],
    output: previewRoutes.PostOutput,
    throws: previewRoutes.PostThrows,
  },
  {
    method: 'POST',
    matcher: '/admin/catalog-structure',
    handler: structureRoutes.POST,
    input: structureRoutes.PostInput,
    // The file is the source: it creates, edits and deletes groupings, and rewrites the menu.
    permissions: ['product.create', 'product.update', 'product.delete', 'store.update'],
    operationId: 'applyCatalogStructure',
    summary: 'Apply a structure file',
    description:
      "Makes the store's Categories, Collections and menu the file's, matched by handle. Groupings the file leaves out are deleted, and every ruled grouping is re-matched. A file with errors is refused.",
    tags: [Tags.PRODUCTS],
    output: structureRoutes.PostOutput,
    throws: structureRoutes.PostThrows,
  },
] satisfies RouteDefinition[]
