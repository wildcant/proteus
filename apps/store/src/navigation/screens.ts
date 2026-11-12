import type { FileRouteTypes } from '#/routeTree.gen'

/**
 * One screen of the design file's flow map, or one state of it, in the router.
 *
 * - `route`: the route that renders it. check:flow (`pnpm --filter @proteus/design run flow:check`) reads it: every
 *   route is some screen's, and every leaf route renders the screen its entry names, itself or through the layout
 *   above it. A drawer is a state of the screen it covers, so its leaf renders a form while its layout renders the
 *   screen. A layout that renders only `<Outlet />`, or redirects with no component, is no screen's.
 * - `to` and `search`: where a link to it goes. `'.'` stays on the current page, for the overlays every page has.
 */
type ScreenEntry = {
  route: FileRouteTypes['id']
  to?: FileRouteTypes['to'] | '.'
  search?: Record<string, string | undefined>
}

/**
 * The design's screens, by their screen set's name, and a state where it has a route or URL of its own
 * (`AddressBook/addressEdit`). A transition to a state with no entry here lands on its screen's entry.
 *
 * Node reads this file as is for check:flow, so it imports types only.
 */
export const screens = {
  // The `_main` chrome: header, footer and the overlays over every page (`?modal=`, declared on the root route).
  Root: { route: '/_main', to: '.', search: { modal: undefined } },
  'Root/menu': { route: '/_main', to: '.', search: { modal: 'menu' } },
  'Root/search': { route: '/_main', to: '.', search: { modal: 'search' } },
  'Root/bag': { route: '/_main', to: '.', search: { modal: 'cart' } },
  // The chrome of the auth and checkout layouts: their way back to the store.
  AuthLayout: { route: '/_auth' },
  CheckoutLayout: { route: '/_checkout' },
  // No route of its own: the router renders it under the root for any path it doesn't match.
  NotFound: { route: '__root__' },

  ProductListPage: { route: '/_main/', to: '/' },
  'ProductListPage/category': { route: '/_main/categories/$handle', to: '/categories/$handle' },
  'ProductListPage/collection': { route: '/_main/collections/$handle', to: '/collections/$handle' },
  ProductDetail: { route: '/_main/products/$productId', to: '/products/$productId' },

  CheckoutContent: { route: '/_checkout/checkout/', to: '/checkout' },
  'CheckoutContent/addressCreate': {
    route: '/_checkout/checkout/addresses/new',
    to: '/checkout/addresses/new',
  },
  'CheckoutContent/addressEdit': {
    route: '/_checkout/checkout/addresses/$addressId/edit',
    to: '/checkout/addresses/$addressId/edit',
  },
  CheckoutReturn: { route: '/_checkout/checkout-return', to: '/checkout-return' },
  OrderConfirmedContent: { route: '/_main/order/$orderId/confirmed', to: '/order/$orderId/confirmed' },

  AccountDetail: { route: '/_main/_authed/account/', to: '/account' },
  OrderContent: { route: '/_main/_authed/account/orders/$orderId', to: '/account/orders/$orderId' },
  PaymentMethodsBook: { route: '/_main/_authed/account/payment-methods', to: '/account/payment-methods' },
  AddressBook: { route: '/_main/_authed/account/addresses/', to: '/account/addresses' },
  'AddressBook/addressCreate': { route: '/_main/_authed/account/addresses/new', to: '/account/addresses/new' },
  'AddressBook/addressEdit': {
    route: '/_main/_authed/account/addresses/$addressId/edit',
    to: '/account/addresses/$addressId/edit',
  },

  LoginForm: { route: '/_auth/login', to: '/login' },
  RegisterForm: { route: '/_auth/signup', to: '/signup' },
  ForgotPasswordForm: { route: '/_auth/forgot-password', to: '/forgot-password' },
  ResetPasswordForm: { route: '/_auth/reset-password', to: '/reset-password' },
  VerifyPage: { route: '/_auth/verify', to: '/verify' },
} as const satisfies Record<string, ScreenEntry>

export type ScreenKey = keyof typeof screens
