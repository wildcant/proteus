import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { PackageIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { ButtonLink } from '#/components/ui/button/button'
import {
  productListNotFound,
  productListNotFoundAction,
  productListNotFoundBody,
  productListNotFoundIcon,
  productListNotFoundMessage,
  productListNotFoundPackage,
  productListNotFoundText,
  productListNotFoundTitle,
} from '#/features/products/components/product-list-not-found/product-list-not-found.variants'
import type { LinkTarget } from '#/lib/link-target'

/**
 * What a scoped list page — a category, a collection — shows when its handle names nothing the
 * store shows: one it never had, one the merchant hid, or one whose ancestor is hidden. Modelled on
 * `ProductError`, inside the store's header and footer, and like it the copy does not guess which.
 *
 * Each page brings its own words; the way out is the same, the whole catalogue.
 */
export function ProductListNotFound({
  heading,
  body,
  shopAllLink,
}: {
  heading: ReactNode
  body: ReactNode
  /** SHOP_ALL. */
  shopAllLink: LinkTarget
}) {
  return (
    // `mx-auto w-full` centres the capped page, which the design file draws as stretched.
    <main className={cn(productListNotFound(), 'mx-auto w-full')}>
      <PackageIcon className={cn(productListNotFoundIcon(), productListNotFoundPackage())} strokeWidth={1.5} />
      <div className={productListNotFoundBody()}>
        <div className={productListNotFoundText()}>
          <h1 className={productListNotFoundTitle()}>{heading}</h1>
          <p className={productListNotFoundMessage()}>{body}</p>
        </div>
        <ButtonLink {...shopAllLink} className={productListNotFoundAction()}>
          <Trans>Shop all</Trans>
        </ButtonLink>
      </div>
    </main>
  )
}
