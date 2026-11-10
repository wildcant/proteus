import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { productTable } from './models/product.js'
import { productCategoryTable } from './models/product-category.js'
import { productCollectionTable } from './models/product-collection.js'
import { productImageTable } from './models/product-image.js'
import { productOptionTable } from './models/product-option.js'
import { productOptionValueTable } from './models/product-option-value.js'
import { productProductCategoryTable } from './models/product-product-category.js'
import { productProductCollectionTable } from './models/product-product-collection.js'
import { productProductOptionTable } from './models/product-product-option.js'
import { productProductOptionValueTable } from './models/product-product-option-value.js'
import { productTypeTable } from './models/product-type.js'
import { productVariantTable } from './models/product-variant.js'
import { productVariantImageTable } from './models/product-variant-image.js'
import { productVariantOptionTable } from './models/product-variant-option.js'
import { ProductRepository } from './repositories/product.js'
import { ProductCategoryRepository } from './repositories/product-category.js'
import { ProductCollectionRepository } from './repositories/product-collection.js'
import { ProductImageRepository } from './repositories/product-image.js'
import { ProductOptionRepository } from './repositories/product-option.js'
import { ProductOptionValueRepository } from './repositories/product-option-value.js'
import { ProductProductCategoryRepository } from './repositories/product-product-category.js'
import { ProductProductCollectionRepository } from './repositories/product-product-collection.js'
import { ProductProductOptionRepository } from './repositories/product-product-option.js'
import { ProductProductOptionValueRepository } from './repositories/product-product-option-value.js'
import { ProductTypeRepository } from './repositories/product-type.js'
import { ProductVariantRepository } from './repositories/product-variant.js'
import { ProductVariantImageRepository } from './repositories/product-variant-image.js'
import { ProductVariantOptionRepository } from './repositories/product-variant-option.js'
import { ProductModuleService } from './services/product-module-service.js'

export default Module(Modules.PRODUCT, {
  service: ProductModuleService,
  features: [
    { id: 'product.read', title: 'View products' },
    { id: 'product.create', title: 'Create products' },
    { id: 'product.update', title: 'Edit products' },
    { id: 'product.delete', title: 'Delete products' },
  ],
  models: {
    productCategoryTable,
    productCollectionTable,
    productImageTable,
    productOptionTable,
    productOptionValueTable,
    productProductCategoryTable,
    productProductCollectionTable,
    productProductOptionTable,
    productProductOptionValueTable,
    productTable,
    productTypeTable,
    productVariantImageTable,
    productVariantOptionTable,
    productVariantTable,
  },
  repositories: {
    productRepository: ProductRepository,
    productVariantRepository: ProductVariantRepository,
    productOptionRepository: ProductOptionRepository,
    productOptionValueRepository: ProductOptionValueRepository,
    productProductOptionRepository: ProductProductOptionRepository,
    productProductOptionValueRepository: ProductProductOptionValueRepository,
    productImageRepository: ProductImageRepository,
    productVariantImageRepository: ProductVariantImageRepository,
    productVariantOptionRepository: ProductVariantOptionRepository,
    productCategoryRepository: ProductCategoryRepository,
    productProductCategoryRepository: ProductProductCategoryRepository,
    productCollectionRepository: ProductCollectionRepository,
    productProductCollectionRepository: ProductProductCollectionRepository,
    productTypeRepository: ProductTypeRepository,
  },
})
