import { productCollectionTable } from '../models/product-collection.js'
import { productProductCollectionTable } from '../models/product-product-collection.js'
import { ProductGroupingPivotRepository } from './product-grouping-pivot.js'

/** A product's Collections, by title. */
export class ProductProductCollectionRepository extends ProductGroupingPivotRepository({
  pivot: productProductCollectionTable,
  groupingKey: 'collectionId',
  grouping: productCollectionTable,
  orderBy: productCollectionTable.title,
}) {}
