import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { productTable } from './models/product.js'
import { productImageTable } from './models/product-image.js'
import { productOptionTable } from './models/product-option.js'
import { productOptionValueTable } from './models/product-option-value.js'
import { productProductOptionTable } from './models/product-product-option.js'
import { productProductOptionValueTable } from './models/product-product-option-value.js'
import { productVariantTable } from './models/product-variant.js'
import { productVariantImageTable } from './models/product-variant-image.js'
import { productVariantOptionTable } from './models/product-variant-option.js'
import { ProductRepository } from './repositories/product.js'
import { ProductImageRepository } from './repositories/product-image.js'
import { ProductOptionRepository } from './repositories/product-option.js'
import { ProductOptionValueRepository } from './repositories/product-option-value.js'
import { ProductProductOptionRepository } from './repositories/product-product-option.js'
import { ProductProductOptionValueRepository } from './repositories/product-product-option-value.js'
import { ProductVariantRepository } from './repositories/product-variant.js'
import { ProductVariantImageRepository } from './repositories/product-variant-image.js'
import { ProductVariantOptionRepository } from './repositories/product-variant-option.js'
import { ProductModuleService } from './services/product-module-service.js'

export default Module(Modules.PRODUCT, {
  service: ProductModuleService,
  models: {
    productImageTable,
    productOptionTable,
    productOptionValueTable,
    productProductOptionTable,
    productProductOptionValueTable,
    productTable,
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
  },
})
