# 02 — Storefront shell: route restructure + nav + side menu + footer + checkout skeleton

**What to build:** Restructure the store's route tree so different sections of the store can have different layouts, then build the new layout components.

**Route restructure:** Move Header and Footer out of the root document shell (`__root.tsx`). The root shell should render only `<html>`, theme init script, `<body>`, devtools, `<Toaster />`, and scripts — no layout components. Keep `<Toaster />` in the root shell so toasts work on all pages including checkout. Create two layout routes:

- `_main` layout — renders the new Nav component, an Outlet for child content, and the new Footer. All existing routes (home, login, forgot-password, reset-password, verify, products, account) move under this layout. The `_authed` guard nests inside `_main`.
- `_checkout` layout — renders a minimal 3-column header (left: "Back to cart" link with left arrow, center: "Proteus" logo, right: empty spacer), an Outlet, and nothing else. Contains a placeholder checkout page ("Checkout — Coming soon"). No nav hamburger, no footer.

URL paths are unchanged — underscore-prefixed layout routes don't appear in URLs. `/login` stays `/login`, `/account` stays `/account`.

**Important: route file migration.** When route files move under `_main/`, their `createFileRoute()` path strings must update (e.g., `createFileRoute('/login')` becomes `createFileRoute('/_main/login')`). Run the route tree generator after moving files — it auto-updates these strings. The root index (`routes/index.tsx`) becomes `routes/_main/index.tsx` with path `'/_main/'`. The products layout route and `_authed` guard also move and get new path prefixes. After all moves, run `npm run --workspace=store generate-routes` to regenerate `routeTree.gen.ts`.

**Nav component:** Sticky 3-column header (`sticky top-0 z-50`):
- Left: hamburger button that opens the side menu
- Center: "Proteus" text logo linking to `/`
- Right: cart icon (placeholder for now — no count badge, no dropdown, just an icon linking to `/cart`)

Uses Proteus design tokens (`var(--header-bg)`, `var(--line)`, `backdrop-blur-lg`). Container uses the existing `page-wrap` class.

**Side menu:** Uses `Sheet` from `@proteus/ui` with `side="left"`. Contains:
- Close button (top area)
- Navigation links: Home, Products, Account, Cart
- ThemeToggle (moved from the old header — the old Header component is deleted)
- Copyright line at bottom

**Footer:** Rewrite the existing footer as a 3-column responsive grid (stacks on mobile, 3-col on desktop):
- Shop: Home, Products, Cart
- Help: FAQ, Contact
- Company: About

Links are placeholder (point to `/` or `#`). Copyright row below. Uses `page-wrap` container and Proteus design tokens.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `__root.tsx` no longer renders Header or Footer — only the document shell
- [ ] `_main` layout route exists and renders Nav + Outlet + Footer
- [ ] All existing routes (home, login, forgot-password, reset-password, verify, products, `_authed/account`) moved under `_main`
- [ ] All existing pages still work at their original URLs (no URL changes)
- [ ] Existing E2E tests (`auth.spec.ts`, `products.spec.ts`) still pass after the restructure
- [ ] Nav is sticky with 3-column layout: hamburger | "Proteus" logo | cart icon
- [ ] Clicking hamburger opens a Sheet (side=left) with Home, Products, Account, Cart links
- [ ] Side menu includes ThemeToggle (light/dark/auto switching still works)
- [ ] Closing the Sheet (close button or clicking outside) dismisses it
- [ ] Old `Header.tsx` component is deleted (replaced by the new nav)
- [ ] Footer shows 3-column placeholder links (Shop/Help/Company) and copyright
- [ ] `_checkout` layout route exists with minimal header: "Back to cart" link + "Proteus" logo
- [ ] `/checkout` renders the minimal header and a placeholder page — no nav hamburger, no footer
- [ ] Route tree auto-generation still works (`npm run --workspace=store generate-routes` or equivalent)
