import { I18nProvider } from '@lingui/react'
import { RouterProvider } from '@tanstack/react-router'
import ReactDOM from 'react-dom/client'
import { setupDataTable } from './components/data-table/config'
import { createI18n } from './lib/i18n/catalogs'
import { activeLocale, catalogLanguageFor } from './lib/i18n/locale'
import { getRouter } from './router'

setupDataTable()

const router = getRouter()

const rootElement = document.getElementById('app')

if (rootElement && !rootElement.innerHTML) {
  const locale = activeLocale()
  document.documentElement.lang = locale
  // The catalog loads before the first render, so no page ever paints in the wrong language.
  const i18n = await createI18n(catalogLanguageFor(locale))
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <I18nProvider i18n={i18n}>
      <RouterProvider router={router} />
    </I18nProvider>,
  )
}
