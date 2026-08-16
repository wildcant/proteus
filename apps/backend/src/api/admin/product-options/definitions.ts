import type { RouteDefinition } from '@framework/http/types.js'
import { searchable, Tags } from '@framework/http/types.js'
import type { ProductDTO, ProductOptionDTO, ProductOptionValueDTO } from '../../../core/types/product/common.js'
import * as productsForOptionRoutes from './[id]/products/route.js'
import * as optionByIdRoutes from './[id]/route.js'
import * as valuesForOptionRoutes from './[id]/values/route.js'
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
  {
    method: 'GET',
    matcher: '/admin/product-options/:id/products',
    handler: productsForOptionRoutes.GET,
    input: productsForOptionRoutes.GetInput,
    searchableColumns: searchable<ProductDTO>('title', 'handle'),
    operationId: 'listProductsForOption',
    summary: 'List products linked to an option',
    tags: [Tags.PRODUCT_OPTIONS],
    output: productsForOptionRoutes.GetOutput,
  },
  {
    method: 'GET',
    matcher: '/admin/product-options/:id/values',
    handler: valuesForOptionRoutes.GET,
    input: valuesForOptionRoutes.GetInput,
    searchableColumns: searchable<ProductOptionValueDTO>('value'),
    operationId: 'listValuesForOption',
    summary: 'List values for an option',
    tags: [Tags.PRODUCT_OPTIONS],
    output: valuesForOptionRoutes.GetOutput,
  },
] satisfies RouteDefinition[]
