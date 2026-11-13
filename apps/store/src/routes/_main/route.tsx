import { createFileRoute, Outlet } from '@tanstack/react-router'
import type { HeaderLinks } from '#/components/header/header-links'
import type { MenuLinkTo } from '#/components/header/menu'
import { Footer, type FooterLinkTargets } from '#/components/store/footer/footer'
import { Header } from '#/components/store/header/header'
import { useMe } from '#/entities/customer/api/customer'
import { NetworkArtwork } from '#/entities/payment-method/ui/network-mark/network-mark'
import { CartDrawer } from '#/features/cart/components/cart-drawer/cart-drawer'
import { CartMismatchBanner } from '#/features/cart/components/cart-mismatch-banner/cart-mismatch-banner'
import { CartTrigger } from '#/features/cart/components/cart-trigger/cart-trigger'
import type { BagLinks } from '#/features/cart/types/links'
import { navigationQueryOptions, useSuspenseNavigation } from '#/features/products/api/navigation'
import { categoryTreeQueryOptions, useSuspenseCategoryTree } from '#/features/products/api/product-categories'
import { SearchDrawer } from '#/features/products/components/search-drawer/search-drawer'
import type { SearchLinks } from '#/features/products/types/links'
import { useMarket } from '#/hooks/use-market'
import { marketHeadLinksFor } from '#/lib/seo/market-links'
import { flowLinks } from '#/navigation/links'

// The `Root` screen's ways out, handed to the chrome, which imports no navigation code.
const links = flowLinks('Root')

/** A menu destination: Shop all, a Category or a Collection, a filter riding along. */
const menuLink: MenuLinkTo = (target) => {
  if (!target) return links.MENU_LINK('ProductListPage')
  const params = { handle: target.handle }
  const search = target.filter ? { filter: target.filter } : undefined
  return target.type === 'collection'
    ? links.MENU_LINK('ProductListPage/collection', { params, search })
    : links.MENU_LINK('ProductListPage/category', { params, search })
}
const productLink = (productId: string) => links.PRODUCT({ params: { productId } })

const headerLinks: HeaderLinks = {
  home: links.HOME(),
  account: links.ACCOUNT(),
  menu: menuLink,
  openMenu: links.OPEN_MENU(),
  openSearch: links.OPEN_SEARCH(),
  close: links.CLOSE(),
}
const footerLinks: FooterLinkTargets = {
  menu: menuLink,
  signIn: links.SIGN_IN(),
  createAccount: links.CREATE_ACCOUNT(),
}
const searchLinks: SearchLinks = {
  open: links.OPEN_SEARCH(),
  close: links.CLOSE(),
  product: productLink,
  submit: (term) => links.SEARCH_SUBMIT({ search: term ? { q: term } : {} }),
  viewAll: (term) => links.VIEW_ALL_RESULTS({ search: { q: term } }),
  bestSellers: links.VIEW_BEST_SELLERS(),
}
const bagLinks: BagLinks = {
  open: links.OPEN_BAG('Root/bag'),
  openEmpty: links.OPEN_BAG('Root/bagEmpty'),
  close: links.CLOSE(),
  checkout: links.CHECKOUT(),
  product: productLink,
  browse: links.BROWSE(),
}

export const Route = createFileRoute('/_main')({
  ssr: true,
  head: (context) => ({ links: marketHeadLinksFor(context) }),
  // The menu and the Category tree it resolves against, which the nav renders only under this
  // layout. Child loaders run alongside this one, so a page that needs the tree asks for it again
  // and joins this same request.
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(categoryTreeQueryOptions()),
      context.queryClient.ensureQueryData(navigationQueryOptions(context.market.current.iso2)),
    ])
  },
  component: MainLayout,
})

/**
 * The wrapper around `Outlet` is what keeps the footer at the bottom of a short page. Without
 * it, a page with little content — an order of two items, an empty result set — left the footer
 * floating mid-viewport with dead surface below it. Applied here rather than on each `main` so
 * a route does not have to opt in to being laid out correctly.
 */
function MainLayout() {
  // The app layer is the only place allowed to compose two features, which is why the bag, the
  // drawers and the mismatch banner are wired together here rather than inside the header.
  const { customer } = useMe()
  // Read here and handed down, because the header and footer are shared chrome and the menu is a feature's.
  const menu = { categories: useSuspenseCategoryTree(), ...useSuspenseNavigation(useMarket().current.iso2) }

  return (
    <div className="flex min-h-screen flex-col">
      <Header menu={menu} links={headerLinks} actions={<CartTrigger links={bagLinks} />} />
      <SearchDrawer links={searchLinks} />
      <CartDrawer links={bagLinks} />
      <CartMismatchBanner customerId={customer?.id} />
      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>
      <Footer
        menu={menu}
        links={footerLinks}
        renderPaymentMark={(network) => <NetworkArtwork brand={network} size={28} />}
      />
    </div>
  )
}
