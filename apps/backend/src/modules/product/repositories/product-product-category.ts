import { productCategoryTable } from '../models/product-category.js'
import { productProductCategoryTable } from '../models/product-product-category.js'
import { ProductGroupingPivotRepository } from './product-grouping-pivot.js'

/** A product's direct Categories, by name. */
export class ProductProductCategoryRepository extends ProductGroupingPivotRepository({
  pivot: productProductCategoryTable,
  groupingKey: 'categoryId',
  grouping: productCategoryTable,
  orderBy: productCategoryTable.name,
}) {}
