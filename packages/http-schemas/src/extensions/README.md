# HTTP schemas of extensions

A fork's schemas that its storefront or admin also use (a form's), one folder per backend extension
(`src/extensions/<ext>/` in the backend), split by scope: `<ext>/store/<domain>/…` and
`<ext>/admin/<domain>/…`. The storefront may not import an `admin/` folder, an extension's included.

- Imported by path through the package's one wildcard export:
  `@proteus/http-schemas/extensions/<ext>/store/<domain>/payloads`. No `index.ts`, no barrel (ADR-0028).
- Each file imports `../../../../openapi-setup.js` itself: it can load before any of the package's
  barrels, which is where `.openapi()` is otherwise installed.
- Names carry the extension's Pascal prefix (`PisosDjShippingCity`), since they become OpenAPI
  component names.
- Messages are marked with `i18n.t('…')` as in the package and land in `<ext>/locales/{en,es}.po`, the
  extension's own catalog (`pnpm --filter @proteus/http-schemas run i18n:extract`, translate,
  `i18n:compile`). The backend merges it through the extension registry; the storefront and admin load
  `@proteus/http-schemas/extensions/<ext>/locales/{language}` in their `src/lib/i18n/catalogs.ts`.

Proteus ships this folder empty.
