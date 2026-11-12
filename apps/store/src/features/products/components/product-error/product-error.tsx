import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { ButtonLink } from '#/components/ui/button/button'
import { Icon } from '#/components/ui/icon/icon'
import {
  productError,
  productErrorAction,
  productErrorBody,
  productErrorIcon,
  productErrorMessage,
  productErrorPackage,
  productErrorText,
  productErrorTitle,
} from '#/features/products/components/product-error/product-error.variants'

/**
 * What the detail route shows when it has no product to show: the route's `errorComponent` when the
 * read failed, and `ProductDetail`'s own answer to a 404.
 *
 * The copy does not guess why. A product the store never had, one this market cannot price and one
 * whose read fell over all read the same — the middle one is the ordinary case now that a market
 * decides the catalogue, and the bag notice above says so by name when that is what happened.
 *
 * The way out is the catalogue, because it is the one page that is certainly there: whatever the
 * shopper is standing in, it has products it can sell them.
 */
export function ProductError() {
  return (
    // `mx-auto w-full` centres the capped page, which the design file draws as stretched.
    <main className={cn(productError(), 'mx-auto w-full')}>
      <Icon name="package" className={cn(productErrorIcon(), productErrorPackage())} strokeWidth={1.5} />
      <div className={productErrorBody()}>
        <div className={productErrorText()}>
          <h1 className={productErrorTitle()}>
            <Trans>We couldn't show this product</Trans>
          </h1>
          <p className={productErrorMessage()}>
            <Trans>It may not be one we sell here.</Trans>
          </p>
        </div>
        <ButtonLink to="/" className={productErrorAction()}>
          <Trans>Browse products</Trans>
        </ButtonLink>
      </div>
    </main>
  )
}
