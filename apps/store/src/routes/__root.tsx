import { Toaster } from '@proteus/ui'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { formDevtoolsPlugin } from '@tanstack/react-form-devtools'
import type { QueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createRootRouteWithContext, HeadContent, Outlet, Scripts, useRouter } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { SHOW_DEVTOOLS } from '#/env.ts'
import { MARKET_GLOBAL, type MarketContext } from '#/lib/market'
import { modalSearchSchema } from '#/lib/modal-state'
import manropeFont from '../assets/fonts/Manrope-VariableFont_wght.woff2?url'
import appCss from '../styles.css?url'

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`

/**
 * Hands the markets the server resolved to the client router, which is created before any route
 * has loaded and so has nowhere else to read them from. A plain script rather than a module, so it
 * runs while the document is parsed — the entry module is deferred and runs after it.
 *
 * `<` is escaped because a `</script>` inside a string literal ends the element. This now carries
 * merchant-authored country names rather than locale codes alone, so the escape has stopped being
 * a precaution against a shape that might grow and become the thing keeping the document valid.
 */
function marketInitScript(market: MarketContext): string {
  const payload = JSON.stringify({ markets: market.markets })
  return `window.${MARKET_GLOBAL}=${payload.replace(/</g, '\\u003c')};`
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient; market: MarketContext }>()({
  ssr: true,
  // Declared here so every route inherits it — see src/lib/modal-state.ts.
  validateSearch: modalSearchSchema,
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Proteus',
      },
      {
        name: 'description',
        content: 'Proteus — modern storefront powered by TanStack Start',
      },
    ],
    links: [
      {
        rel: 'preload',
        href: manropeFont,
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  return (
    <>
      <Outlet />
      <ReactQueryDevtools buttonPosition="bottom-left" />
    </>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  // From the router rather than a route context hook: the shell wraps the match tree, so there is
  // no match to read from here. The market is fixed for the life of a router — switching one is a
  // document navigation — so a plain read is correct and needs no subscription.
  const { market } = useRouter().options.context

  return (
    // The locale code is the language tag. Until catalogues land, es-CO serves English under a
    // Spanish tag: a known trade-off, taken because it becomes correct the day the catalogues
    // exist, where hardcoding English would be a flag someone has to remember to flip.
    <html lang={market.current.localeCode} suppressHydrationWarning>
      <head>
        {/** biome-ignore lint/security/noDangerouslySetInnerHtml: Tanstack start default */}
        {/* biome-ignore lint/style/useNamingConvention: React API */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/** biome-ignore lint/security/noDangerouslySetInnerHtml: inlining resolved server state */}
        {/* biome-ignore lint/style/useNamingConvention: React API */}
        <script dangerouslySetInnerHTML={{ __html: marketInitScript(market) }} />
        <HeadContent />
      </head>
      <body className="wrap-anywhere font-sans antialiased selection:bg-[rgba(79,184,178,0.24)]">
        {children}
        {/* The PDP's action bar owns the bottom-4 lane on the phone, and a failed add-to-cart
            toast would land on top of the button you press to retry it. */}
        <Toaster viewportClassName="bottom-20 lg:bottom-4" />
        {!!SHOW_DEVTOOLS && (
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
              formDevtoolsPlugin(),
            ]}
          />
        )}
        <Scripts />
      </body>
    </html>
  )
}
