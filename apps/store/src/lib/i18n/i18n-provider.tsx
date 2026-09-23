import { I18nProvider } from '@lingui/react'
import { useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'

/**
 * The router's `InnerWrap`: provides this router's own Lingui instance to everything it renders.
 *
 * `InnerWrap` rather than `Wrap`, because it renders inside the router context and above the root
 * match, so `RootDocument` is covered too. Not a root `beforeLoad`: dehydrated matches skip it on
 * hydration, and the client would hydrate against an instance nothing activated.
 */
export function I18nRouterProvider({ children }: { children: ReactNode }) {
  const { i18n } = useRouter().options.context
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}
