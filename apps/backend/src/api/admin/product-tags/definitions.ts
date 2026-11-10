import type { RouteDefinition } from '@framework/http/types.js'
import { searchable, Tags } from '@framework/http/types.js'
import type { ProductTagDTO } from '../../../core/types/product/common.js'
import * as productTagByIdRoutes from './[id]/route.js'
import * as productTagRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/product-tags',
    handler: productTagRoutes.GET,
    input: productTagRoutes.GetInput,
    searchableColumns: searchable<ProductTagDTO>('value'),
    permissions: ['product.read'],
    operationId: 'listProductTags',
    summary: 'List Tags',
    tags: [Tags.PRODUCT_TAGS],
    output: productTagRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/product-tags',
    handler: productTagRoutes.POST,
    input: productTagRoutes.PostInput,
    permissions: ['product.create'],
    operationId: 'createProductTag',
    summary: 'Create a Tag',
    tags: [Tags.PRODUCT_TAGS],
    output: productTagRoutes.PostOutput,
    throws: productTagRoutes.PostThrows,
  },
  {
    method: 'GET',
    matcher: '/admin/product-tags/:id',
    handler: productTagByIdRoutes.GET,
    input: productTagByIdRoutes.GetInput,
    permissions: ['product.read'],
    operationId: 'getProductTag',
    summary: 'Retrieve a Tag',
    tags: [Tags.PRODUCT_TAGS],
    output: productTagByIdRoutes.GetOutput,
    throws: productTagByIdRoutes.GetThrows,
  },
  {
    method: 'PATCH',
    matcher: '/admin/product-tags/:id',
    handler: productTagByIdRoutes.PATCH,
    input: productTagByIdRoutes.PatchInput,
    permissions: ['product.update'],
    operationId: 'updateProductTag',
    summary: 'Rename a Tag',
    tags: [Tags.PRODUCT_TAGS],
    output: productTagByIdRoutes.PatchOutput,
    throws: productTagByIdRoutes.PatchThrows,
  },
  {
    method: 'DELETE',
    matcher: '/admin/product-tags/:id',
    handler: productTagByIdRoutes.DELETE,
    input: productTagByIdRoutes.DeleteInput,
    permissions: ['product.delete'],
    operationId: 'deleteProductTag',
    summary: 'Delete a Tag',
    tags: [Tags.PRODUCT_TAGS],
    output: productTagByIdRoutes.DeleteOutput,
  },
] satisfies RouteDefinition[]
