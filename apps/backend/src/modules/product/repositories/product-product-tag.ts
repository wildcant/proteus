import { productProductTagTable } from '../models/product-product-tag.js'
import { productTagTable } from '../models/product-tag.js'
import { ProductGroupingPivotRepository } from './product-grouping-pivot.js'

/** A product's Tags, by value. */
export class ProductProductTagRepository extends ProductGroupingPivotRepository({
  pivot: productProductTagTable,
  groupingKey: 'tagId',
  grouping: productTagTable,
  orderBy: productTagTable.value,
}) {}
