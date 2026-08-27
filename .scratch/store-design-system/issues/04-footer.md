# 04 — Footer

The footer is nine links in three columns, and three of them — FAQ, Contact, About — are declared
`to: '/'` because the pages do not exist. Its headings are `text-xs uppercase tracking-widest`,
hand-rolled the same way the nav wordmark and the old login heading were, and it still reaches for
`--foreground-muted` and `border-border` rather than the tokens.

Most of the work here is not visual. The reference footer has thirty-odd links behind it and we
have four real destinations, so the ticket is mostly a set of honest calls about which slots we can
fill and which we drop.

Depends on `01-token-foundation.md`.

## The reference

```
 Help                Pages                          More About <Brand>
 FAQ                 Stores                         ┌────────┐ ┌────────┐ ┌────────┐
 Track Your Order    Refer a Friend                 │  logo  │ │   %    │ │   ✉    │
 Delivery Info       <Brand> Central               ├────────┤ ├────────┤ ├────────┤
 Returns Policy      …                              │ Blog   │ │ 12% off│ │ Sign Up│
 …                   Sustainability                 └────────┘ └────────┘ └────────┘

 VISA MC PayPal Pay Klarna AmEx Afterpay          ⬤ ⬤ ⬤ ⬤ ⬤ ⬤ ⬤
 ─────────────────────────────────────────────────────────────────────────────────
 © 2026 | … | All Rights Reserved.   Terms & Conditions  Privacy Notice  …   🇺🇸 US ▾  English ▾
```

At phone width it is a different footer, not a narrower one:

```
 ─────────────────────────────
  Help                      ＋
 ─────────────────────────────
  Pages                     －
    FAQ
    Track Your Order
    Delivery Information
 ─────────────────────────────
  More About <Brand>
  ┌──────────┐ ┌──────────┐ ┌─
  │  logo    │ │    %     │ │
  ├──────────┤ ├──────────┤ ├─
  │ Blog     │ │ 15% off  │ │
  └──────────┘ └──────────┘ └─   ← scrolls
        ⬤ ⬤ ⬤ ⬤ ⬤ ⬤ ⬤
        Terms and Conditions
           Terms of Use
          Privacy Notice
             🌐 ROW ⌄
      VISA  MC  AMEX  PP  Pay
 ─────────────────────────────
   © 2026 | <Brand> Limited…
```

The link columns become an accordion — heading, hairline rule, `＋` that turns to `－`, links
revealed beneath in the same muted grey. Everything below it centres, and the order changes rather
than merely reflowing: social sits above the legal links on the phone and beside the payment marks
on desktop. The tiles turn into a horizontally scrolling row with the third peeking off the right
edge, which is what tells you to swipe.

Column headings 14px bold ink; links 14px `#767a7f` at ~18px rhythm, sentence case, no underline
until hover. The payment and social rows sit on the same baseline with nothing between them — no
rule, no heading, no "We accept". The bottom bar is the only rule in the whole footer: copyright
muted at the left, legal links underlined ink in the middle, locale at the right. Tile captions sit
on `#f4f5f6` under a white image area, which is the same filled-utility treatment the header search
field uses.

## What we can actually back

| Slot | Us | Why |
|---|---|---|
| Two link columns | **Shop** (Home, All products, Cart) and **Account** (Sign in, Create account) | four real routes, and that is all of them |
| "More About" tiles | dropped | no blog, no loyalty programme, and no email signup — that one needs a `customer.acceptsMarketing` column and a consent flow that do not exist |
| Payment marks | ship, monochrome | see below |
| Social row | ship, config-driven | see below |
| Legal links | **blocked** | see below |
| Locale selector | dropped | no i18n, one currency |

## Decisions

**No link points at `/` as a placeholder.** The footer does this three times today. Link data moves
into one `footerColumns` config and a slot with no destination is omitted rather than stubbed —
a link that silently returns you to the home page is a bug the shopper walks into, not a
placeholder they can read.

**Payment marks are monochrome, not the reference's colour tiles.** The system is ink, surface and
one accent; seven multicolour rectangles are the loudest thing on the page and the only place the
palette breaks. Single-colour marks in `text-ink-subtle` sit down, and `currentColor` gets dark
mode for free instead of needing a second set of assets. Mechanically it is also the cheap option:
the marks are single-path `0 0 24 24` SVGs, and `@proteus/icons` already renders each one as a solid
fill on `currentColor`, so the footer supplies a token and nothing else.

**The strip is aspirational today, and that is a real caveat.** `apps/backend/src/modules/payment/providers/`
holds exactly one provider: `system`, labelled "Manual Payment", `isTestOnly = true`. The store
cannot take a card. Shipping the strip is fine while the storefront is pre-launch — the payments
and legal gate in `.tasks/next-todos` already blocks going live — but it must be reconciled against
the real provider list before the store accepts money, or it is a false claim to a shopper.

**Social links are config-driven and the row disappears when the config is empty.** There are no
accounts to link to yet. The row renders from a `socialLinks` array; empty array, no row, no
markup. Same rule as the links above — nothing points at `#`.

**The phone footer is an accordion, and it is a second DOM tree.** Five links stacked flat push
the copyright a screen and a half down; collapsing them is the reason every storefront footer does
this. Above `sm` the columns are static and always open, which the accordion cannot be talked into
without fighting its own height variable — so the footer renders the accordion `sm:hidden` and the
static columns `hidden sm:grid`.

`spec.md` warns against structural switches across breakpoints, and this is the sanctioned
exception: the switch is pure CSS, so the server renders both and the browser picks with no
viewport detection and no first-paint flash. `display: none` also drops the hidden tree out of the
accessibility tree, so nothing is announced twice. The cost is a duplicated handful of links in the
payload, which is the right trade at this size and would not be at thirty.

**Assets are vendored, not depended on — and they live in `packages/icons`.** Fetched from
simple-icons (CC0-1.0) into `packages/icons/assets/{payment,social}/`, with provenance in
`packages/icons/assets/README.md`. `@proteus/icons` generates a React component per asset, so this
ticket imports marks rather than copying path data into the app; regenerating after an asset changes
is `npm run --workspace=@proteus/icons build:icons`. Sezzle is not in simple-icons and Discord is
specific to the reference's own community programme; both are dropped. Klarna and Afterpay are BNPL
we do not have — Klarna is generated and simply unused until it is.

## Work

- **`packages/ui` — add the accordion.** `npx shadcn@latest add accordion` from `packages/ui`,
  then export it from `src/index.ts` beside the others. Adding a component there is additive and
  safe; it is only `packages/ui`'s `:root` that is off limits, because admin shares it.

  Three things to fix after the CLI runs. The registry source imports `IconPlaceholder` from the
  shadcn site's own app — the CLI should rewrite it to lucide per `"iconLibrary": "lucide"` in
  `components.json`, but check, because the raw file does not compile here. The default trigger
  pairs `ChevronDownIcon` / `ChevronUpIcon`; the reference uses `＋` / `－`, so swap in
  `PlusIcon` / `MinusIcon`. And the trigger carries `hover:underline`, which the reference's
  headings do not — drop it.

  The panel animates with `animate-accordion-down` / `-up` off `--accordion-panel-height`, both of
  which come from `tw-animate-css` and `@base-ui/react`; both are already dependencies.
- **Brand marks — nothing to build.** `@proteus/icons` is already a dependency of the store and
  exports `VisaIcon`, `MastercardIcon`, `AmericanexpressIcon`, `PaypalIcon`, `ApplepayIcon` and the
  six social marks (`InstagramIcon`, `FacebookIcon`, `XIcon`, `TiktokIcon`, `YoutubeIcon`,
  `PinterestIcon`). Each takes `size`, `className` and `title`; every other SVG prop passes through.

  Two things follow from how the package handles labelling. A mark with no `title` and no `aria-*`
  renders `aria-hidden="true"` on its own, which is exactly what the payment strip wants — pass
  nothing. And `XIcon` collides with lucide's `XIcon` (its close icon), so alias one of them at the
  import if this file ever needs both.
- **`components/footer.tsx`** — rewrite. The accordion tree and the static-column tree, one
  `sm:hidden` and the other `hidden sm:grid`, both fed from the same `footerColumns` constant so
  the two can never drift; payment and social rows; a single rule above the bottom bar. Tokens throughout: `border-line`, `text-ink-muted`,
  `bg-surface`. Column headings become `type-heading` at the small end rather than the hand-rolled
  `text-xs uppercase tracking-widest`. Social marks are `<a>`s with `aria-label`s and
  `rel="noreferrer"`, the mark inside left untitled so it stays out of the accessibility tree and
  the anchor is announced once; payment marks are decorative and likewise get no `title`.
- **`components/footer.tsx` config** — `footerColumns` and `socialLinks` as module constants beside
  the component, typed against the router so a bad `to` is a typecheck error rather than a 404.

## Responsive

Written phone-first: the base classes are the accordion footer, and `sm:` swaps in the columns.

**Base (phone).** In order down the page:

1. The accordion — `Shop` and `Account` as items, both closed, a `border-line` rule above each and
   below the last. Trigger is the full row width, `type-heading`, with the `＋`/`－` at the far
   right; links inside are `text-ink-muted` at an 18px rhythm and indent-free.
2. Social marks, centred, if the config has any.
3. Payment marks, centred, wrapping rather than shrinking — 24px is already their floor.
4. A rule, then the copyright, centred.

Everything below the accordion centres, and the legal links slot in between social and payment
once those routes exist — which is the order the reference uses, not the desktop order flowed
narrow.

**`sm:` and up.** The accordion is replaced by the two static columns side by side, left-aligned,
no triggers and no rules. Social and payment stay stacked and centred.

**`lg:` and up.** Payment and social share one baseline at opposite ends; the copyright row goes to
one line with the legal links beside it.

Social marks are links, so they get 44px targets at every width even though the marks are 20px, and
the accordion triggers get the full row — the widest tap target in the footer, which is the point.

## Blocked, and tracked elsewhere

The legal row needs `/terms`, `/privacy` and `/returns` to exist, and they do not. `.tasks/next-todos`
records this as a launch blocker for reasons beyond the footer: `register-form.tsx` already renders
"By creating an account, you agree to our Privacy Policy and Terms of Use" as plain text, asserting
agreement to documents that are unreachable, and Stripe and PayPal both require a published privacy
policy before they will keep an account open. Until those routes land the footer omits the row.
Writing them is one ticket that fixes the signup copy and the footer together.

## Constraint

`apps/store/tests/e2e/cart.spec.ts` asserts four things about the footer: that `page.locator('footer')`
is visible on `/cart` and absent at `/checkout`, and that it contains the text `Shop`, `Help`,
`Company` and `/Proteus\. All rights reserved/`.

The element stays and so does the copyright line. `Shop` survives as a column heading. `Help` and
`Company` do not — those are exactly the two columns whose every link points at `/` — so the spec
needs updating to the columns that ship. Swap them for `Account` rather than deleting the
assertions; the point of that test is that the footer renders its columns, and it should keep
being able to fail.

The two trees change how those assertions have to be written. `footer.getByText('Shop')` will match
the accordion trigger *and* the static column heading, and Playwright's strict mode fails on two
matches even though only one is visible. Scope with `.filter({ visible: true })` rather than
reaching for `.first()`, which would paper over the day one of them stops rendering. Worth one
extra test at a phone viewport that the accordion opens and reveals its links — that behaviour is
the only piece of the footer with any logic in it.
