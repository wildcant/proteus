import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import * as cancelRoutes from './[id]/cancel/route.js'
import * as confirmRoutes from './[id]/confirm/route.js'
import * as importByIdRoutes from './[id]/route.js'
import * as importRoutes from './route.js'

export default [
  {
    method: 'POST',
    matcher: '/admin/product-imports',
    handler: importRoutes.POST,
    input: importRoutes.PostInput,
    // `overwrite` also needs `product.update`, checked by the handler.
    permissions: ['product.create'],
    operationId: 'createProductImport',
    summary: 'Preview a product CSV import',
    description:
      'Reads an uploaded Shopify-format product CSV and records a `previewed` job with what it would create, update and skip, and every error with its line. A job with errors cannot be confirmed.',
    tags: [Tags.PRODUCTS],
    output: importRoutes.PostOutput,
    throws: importRoutes.PostThrows,
  },
  {
    method: 'GET',
    matcher: '/admin/product-imports/:id',
    handler: importByIdRoutes.GET,
    input: importByIdRoutes.GetInput,
    permissions: ['product.read'],
    operationId: 'getProductImport',
    summary: 'Retrieve a product import',
    tags: [Tags.PRODUCTS],
    output: importByIdRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/product-imports/:id/confirm',
    handler: confirmRoutes.POST,
    input: confirmRoutes.PostInput,
    permissions: ['product.create'],
    operationId: 'confirmProductImport',
    summary: 'Start a previewed product import',
    tags: [Tags.PRODUCTS],
    output: confirmRoutes.PostOutput,
    throws: confirmRoutes.PostThrows,
  },
  {
    method: 'POST',
    matcher: '/admin/product-imports/:id/cancel',
    handler: cancelRoutes.POST,
    input: cancelRoutes.PostInput,
    permissions: ['product.create'],
    operationId: 'cancelProductImport',
    summary: 'Cancel a previewed product import',
    tags: [Tags.PRODUCTS],
    output: cancelRoutes.PostOutput,
    throws: cancelRoutes.PostThrows,
  },
] satisfies RouteDefinition[]
