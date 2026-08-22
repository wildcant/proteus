import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { ProductRepository } from './repositories/product.js'
import { ProductImageRepository } from './repositories/product-image.js'
import { ProductOptionRepository } from './repositories/product-option.js'
import { ProductOptionValueRepository } from './repositories/product-option-value.js'
import { ProductProductOptionRepository } from './repositories/product-product-option.js'
import { ProductProductOptionValueRepository } from './repositories/product-product-option-value.js'
import { ProductVariantRepository } from './repositories/product-variant.js'
import { ProductVariantImageRepository } from './repositories/product-variant-image.js'
import { ProductModuleService } from './services/product-module-service.js'

export default Module(Modules.PRODUCT, {
  service: ProductModuleService,
  repositories: {
    productRepository: ProductRepository,
    productVariantRepository: ProductVariantRepository,
    productOptionRepository: ProductOptionRepository,
    productOptionValueRepository: ProductOptionValueRepository,
    productProductOptionRepository: ProductProductOptionRepository,
    productProductOptionValueRepository: ProductProductOptionValueRepository,
    productImageRepository: ProductImageRepository,
    productVariantImageRepository: ProductVariantImageRepository,
  },
})
