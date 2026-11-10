import type { RouteDefinition } from '@framework/http/types.js'
import { searchable, Tags } from '@framework/http/types.js'
import type { ProductTypeDTO } from '../../../core/types/product/common.js'
import * as productTypeByIdRoutes from './[id]/route.js'
import * as productTypeRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/product-types',
    handler: productTypeRoutes.GET,
    input: productTypeRoutes.GetInput,
    searchableColumns: searchable<ProductTypeDTO>('value'),
    permissions: ['product.read'],
    operationId: 'listProductTypes',
    summary: 'List Product Types',
    tags: [Tags.PRODUCT_TYPES],
    output: productTypeRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/product-types',
    handler: productTypeRoutes.POST,
    input: productTypeRoutes.PostInput,
    permissions: ['product.create'],
    operationId: 'createProductType',
    summary: 'Create a Product Type',
    tags: [Tags.PRODUCT_TYPES],
    output: productTypeRoutes.PostOutput,
    throws: productTypeRoutes.PostThrows,
  },
  {
    method: 'GET',
    matcher: '/admin/product-types/:id',
    handler: productTypeByIdRoutes.GET,
    input: productTypeByIdRoutes.GetInput,
    permissions: ['product.read'],
    operationId: 'getProductType',
    summary: 'Retrieve a Product Type',
    tags: [Tags.PRODUCT_TYPES],
    output: productTypeByIdRoutes.GetOutput,
    throws: productTypeByIdRoutes.GetThrows,
  },
  {
    method: 'PATCH',
    matcher: '/admin/product-types/:id',
    handler: productTypeByIdRoutes.PATCH,
    input: productTypeByIdRoutes.PatchInput,
    permissions: ['product.update'],
    operationId: 'updateProductType',
    summary: 'Rename a Product Type',
    tags: [Tags.PRODUCT_TYPES],
    output: productTypeByIdRoutes.PatchOutput,
    throws: productTypeByIdRoutes.PatchThrows,
  },
  {
    method: 'DELETE',
    matcher: '/admin/product-types/:id',
    handler: productTypeByIdRoutes.DELETE,
    input: productTypeByIdRoutes.DeleteInput,
    permissions: ['product.delete'],
    operationId: 'deleteProductType',
    summary: 'Delete a Product Type',
    tags: [Tags.PRODUCT_TYPES],
    output: productTypeByIdRoutes.DeleteOutput,
  },
] satisfies RouteDefinition[]
