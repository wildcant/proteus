import type { RouteDefinition } from '@framework/http/types.js'
import { searchable, Tags } from '@framework/http/types.js'
import type { ProductOptionDTO } from '../../../core/types/product/common.js'
import * as optionByIdRoutes from './[id]/route.js'
import * as optionRoutes from './route.js'

export default [
  {
    method: 'GET',
    matcher: '/admin/product-options',
    handler: optionRoutes.GET,
    input: optionRoutes.GetInput,
    searchableColumns: searchable<ProductOptionDTO>('title'),
    operationId: 'listProductOptions',
    summary: 'List product options',
    tags: [Tags.PRODUCT_OPTIONS],
    output: optionRoutes.GetOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/product-options',
    handler: optionRoutes.POST,
    input: optionRoutes.PostInput,
    operationId: 'createProductOption',
    summary: 'Create a product option',
    tags: [Tags.PRODUCT_OPTIONS],
    output: optionRoutes.PostOutput,
  },
  {
    method: 'GET',
    matcher: '/admin/product-options/:id',
    handler: optionByIdRoutes.GET,
    input: optionByIdRoutes.GetInput,
    operationId: 'getProductOption',
    summary: 'Retrieve a product option',
    tags: [Tags.PRODUCT_OPTIONS],
    output: optionByIdRoutes.GetOutput,
  },
  {
    method: 'PATCH',
    matcher: '/admin/product-options/:id',
    handler: optionByIdRoutes.PATCH,
    input: optionByIdRoutes.PatchInput,
    operationId: 'updateProductOption',
    summary: 'Update a product option',
    tags: [Tags.PRODUCT_OPTIONS],
    output: optionByIdRoutes.PatchOutput,
  },
  {
    method: 'DELETE',
    matcher: '/admin/product-options/:id',
    handler: optionByIdRoutes.DELETE,
    input: optionByIdRoutes.DeleteInput,
    operationId: 'deleteProductOption',
    summary: 'Delete a product option',
    tags: [Tags.PRODUCT_OPTIONS],
    output: optionByIdRoutes.DeleteOutput,
  },
] satisfies RouteDefinition[]
