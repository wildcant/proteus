/**
 * The storefront filter key of a product option: `option.Talla`. A metafield key is lowercase letters,
 * digits, `-` and `_`, so no metafield key can take this shape.
 */
export const OPTION_FILTER_PREFIX = 'option.'

/**
 * The built-in filter for products on sale, read from price rather than from the product: `price.sale:on`.
 * The dot keeps it out of the metafield key space, as `option.` does.
 */
export const SALE_FILTER_KEY = 'price.sale'

/** The sale filter's one value. */
export const SALE_FILTER_VALUE = 'on'
