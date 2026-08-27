# 09 — Product detail

The PDP is the one storefront surface that already looked coherent before the token work started,
and that is exactly why it has been left alone the longest. It is now the last page still written in
the pre-token vocabulary: `text-(--foreground-muted)` and `border-border` instead of `text-ink-muted`
and `border-line`, `font-extralight text-4xl … sm:text-5xl` where every other page has a display
role, and `text-xs uppercase tracking-[0.18em]` hand-rolled four times — on the breadcrumb
(`product-detail.tsx:34`), on the subtitle (`:52`), on the picker legend (`variant-picker.tsx:40`)
and on the `VariantSelect` fallback's `Variant` label (`:136`). Those four are the only
`tracking-[0.18em]` left in `apps/store/src`; the equivalent micro-labels went in `03-header.md`
(the wordmark's `text-sm uppercase tracking-[0.2em]`) and in `04-footer.md` (the column headings'
`text-xs uppercase tracking-widest`, which became `type-heading`).

Underneath the styling there are three structural problems the reference throws into relief. The
gallery is a thumbnail rail plus a hero image, which spends a third of the column on navigation
chrome for a product that usually has three photos. The colour swatches are `rounded-full size-11`
circles, so a garment photo is cropped to a 44px disc where the only legible information is the
average colour — which the catalogue does not store, so the disc is a crop of a model shot. And the
size values are `flex flex-wrap` pills, so a seven-size run wraps ragged and the row has no shape.

Depends on `01-token-foundation.md`. Takes the mobile action-bar pattern nowhere else uses yet, and
the `?variant=` URL contract that already ships.

> **Ordering note.** The PDP was queued behind the PLP; it jumps that queue at the user's request,
> and `spec.md:98` has already been resequenced to match — `09` sits after `08`, and the PLP is in
> the "Then" line below it. Nothing here depends on the PLP: the two share the 4:5 image ratio and the `gap-1`
> contact-sheet gutter, and both are recorded in `reference.md` already, so whichever lands first
> sets them. `product-card.tsx` is untouched by this ticket.

## The reference

Measured on 2026-08-26 with `getComputedStyle` and `getBoundingClientRect` against the live PDP at
1440×1000 and 390×844 — not read off a screenshot, so there is no capture scale to solve for and the
numbers below are the computed values themselves.

Desktop, 1440 wide:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ 🔥 1.2k people viewed this in the last 24 hours   ← pill, overlaid on img   │
├───────────────────────────────────────┬─155─┬────── 410 ──────┬─155─────────┤
│ ┌─────────────┐ ┌─────────────┐       │     │ ELEMENT BASELAYER            │
│ │             │ │             │  4px  │     │ LONG SLEEVE T-SHIRT          │
│ │   358×448   │ │   358×448   │       │     │ Compression Fit              │
│ │             │ │             │       │     │ $32              ★3.5  (49)  │
│ └─────────────┘ └─────────────┘       │     │                              │
│ ┌───────────────────────────────────┐ │     │ Designed for lifting. This…  │
│ │                                   │ │     │ Learn more                   │
│ │             720×900               │ │     │                              │
│ │                                   │ │     │ ▣ ▣ ▣ ▣ ▣ ▣ ▣   48×60, 4:5   │
│ └───────────────────────────────────┘ │     │ Heavy Blue                   │
│ ┌─────────────┐ ┌─────────────┐       │     │                              │
│ │             │ │             │       │     │ Select a size    Size Guide  │
│ …  every third image spans the width  │     │ ┌────┬────┬────┬────┐        │
│                                       │     │ │X̶S̶ 🔔│ S  │M̶ 🔔│ L  │  52px  │
│                                       │     │ ├────┼────┼────┼────┤        │
│                                       │     │ │ XL │X̶X̶L̶🔔│3XL │    │        │
│                                       │     │ └────┴────┴────┴────┘        │
│                                       │     │ ✓ Customers say it fits…     │
│                                       │     │ ┌──────────────────────────┐ │
│                                       │     │ │      Add to bag     54px │ │
│                                       │     │ └──────────────────────────┘ │
│                                       │     │ PayPal · Pay in 4            │
│                                       │     │ Klarna  Afterpay  Sezzle     │
│                                       │     │ Unlock Exclusive Rewards     │
│                                       │     │ Earns 256XP                  │
│                                       │     │ Free Standard Delivery >$75  │
│                                       │     │ Get The Look — 3 Products    │
│                                       │     │ ▸ Delivery & Returns         │
│                                       │     │ ▸ Share                      │
└───────────────────────────────────────┴─────┴──────────────────────────────┘
  … then, full width: [Description | Designed For] tabs · "Get The Look" rail ·
    "We Recommend" rail · Reviews (average ratings, per-attribute bars, cards, Load More)
```

The page is 6403px tall. The buy panel ends at ~1540. Everything after it is content, rails and
reviews.

Phone, 390 wide — the same content, three structural differences:

```
┌──────────────────────────┐
│ ☰  🔍   WORDMARK   👤 🛍  │
├──────────────────────────┤
│                          │
│      390 × 488, 4:5      │  ← full-bleed, scroll-snap x mandatory,
│      slide 1 of 6        │    6 slides, scrollWidth 2340, no gap
│                          │
├──────────────────────────┤
│  ELEMENT BASELAYER       │  ← 24px, same 0.9 leading
│  Compression Fit         │
│  $32            ★3.5(49) │
│  …                       │
│  ┌────┬────┬────┬────┐   │  ← still 4 columns, cells 86×52
│  └────┴────┴────┴────┘   │
│                          │
│ ┌──────────────────┐┌──┐ │  ← fixed, bottom:16px, px:24px, gap:8px
│ │   Add to bag     ││ ♡│ │     276×54 ink  +  58×54 outline
│ └──────────────────┘└──┘ │
└──────────────────────────┘
```

1. The gallery is a full-bleed horizontal snap carousel, not the mosaic.
2. The action bar detaches and pins to the bottom of the viewport, over the page, from first paint.
3. The size grid does **not** collapse to fewer columns. Four stays four.

### Measured values

| Element | Measured (1440 / 390) | We use |
|---|---|---|
| Page title | 800, 32px / 24.1px, leading 0.9, uppercase | `type-title` — its clamp already resolves to exactly 32/24 |
| Fit subtitle | 400, 12px, `#9fa3a8` | `text-xs text-ink-subtle` |
| Price | **700**, 14px, ink | `font-bold` on the 14px body default |
| Description | 400, 14px, leading 1.4 | body default, no class |
| Colour name | 400, 12px, `#9fa3a8` | `text-xs text-ink-subtle` |
| Swatch tile | 48×60, `aspect-ratio: 4/5`, 1px transparent border | `w-12 aspect-4/5 border-2 border-transparent` |
| Swatch selected | 2px `#0d1012` | `border-ink` |
| Size grid | `grid`, `repeat(4, 1fr)`, `gap: 0` | `grid grid-cols-4 gap-0` |
| Size cell | 52px tall, `padding 4px 8px`, 1px `#dee0e3` all round | `h-13 px-2 py-1 border border-line` |
| Size cell label | 12px, uppercase, `align-items: flex-end; justify-content: flex-start` | `text-xs uppercase items-end justify-start` |
| Size cell selected | bg `#0d1012`, `#ffffff`, weight 700 | `bg-ink text-surface font-bold` |
| Size cell sold out | `#767a7f` + `text-decoration: line-through` | `text-ink-muted line-through` |
| Legend "Select a size" | 400, 14px, ink | body default |
| Primary button | 54px tall, `padding 16px 24px`, 14px, radius 0 | store `Button` default (`h-13 px-6`, 52px) |
| Gallery slide | 4:5, `object-fit: cover`, radius 0 | `aspect-4/5 object-cover` |
| Gallery gutter | 4px | `gap-1` |
| Mobile action bar | `fixed`, `bottom: 16px`, `padding: 0 24px`, `gap: 8px`, transparent | `fixed inset-x-0 bottom-4` + the page's own gutters |
| Desktop columns | gallery 720, gap 155, panel 410, page gutter 155 | see the container decision below |

Two values are worth calling out because they contradict a natural guess.

**The title is the *title* role, not the display role.** `reference.md` records their
`--fds-type-title-fluid` as `800 · clamp(24px, 32px) · 0.9`, and the PDP `h1` measures 32px at 1440
and 24.1px at 390 — the title clamp, not the display clamp, which would have given 48px. Our
`type-title` is `clamp(1.5rem, 1.32rem + 0.75vw, 2rem)`, which resolves to 32px at 1440 and 24px at
390. It is a direct match with nothing to tune. The PLP's `ALL PRODUCTS` is where `type-display` goes.

**The price is bold, and the size labels are 12px.** Both are one step off what the eye reports from
a screenshot. `$32` is `font-weight: 700` at 14px — their `--fds-type-body-emphasis` — and the size
cells run at 12px uppercase, not 14px. That 12px is why seven sizes fit four columns at 390.

## What we can actually back

Filled by reading `packages/http-schemas/src/store/product/entities.ts`, the response assembled in
`apps/backend/src/api/store/products/[id]/route.ts`, and the module list under
`apps/backend/src/modules/`. Twenty-three slots; we can back nine.

| Slot | Us | Why |
|---|---|---|
| Gallery, multi-image | **ship** | `product.images[]` carries `id`, `url`, `rank`, and the route orders by rank |
| Variant-scoped gallery | **ship** | `variant.imageIds` is already filtered and already used |
| Title | **ship** | `product.title` |
| Fit subtitle | **ship**, when present | `product.subtitle`, nullable — omitted, not stubbed |
| Price | **ship** | `variant.calculatedPrice.calculatedAmount` + `currencyCode` |
| Colourway swatches | **ship, reshaped** | `option.renderAs === 'swatch'` and `value.swatchImageUrl`; but see the decision — a colourway is a *variant* here, not a sibling product |
| Colour name under the strip | **ship** | resolved from `pickerTargets`, as it is today |
| Size grid | **ship** | `option.renderAs === 'text'` |
| Sold-out treatment | **ship, collapsed to one state** | see the decision — `pickerTargets` cannot separate "sold out" from "never offered" |
| Add to cart | **ship** | existing `useAddLineItem` |
| Quantity stepper | **ship — we have this and the reference does not** | `QuantityStepper` already ships; the reference makes you add twice |
| Specs table | **ship — we have this and the reference does not** | `sku`, `material`, `weight`, `originCountry` are real columns |
| Compare-at price / "Regular Price:" strike | dropped | `StoreCalculatedPrice` carries a literal `TODO(pricing): add originalAmount when PriceRule/PriceList is implemented`. There is no second amount to strike through |
| Rating + review count | dropped | no review module. `modules/` is auth, cart, customer, file, fulfillment, inventory, notification, order, payment, pricing, product, user |
| "Customers say it fits true to size" | dropped | derived from review attributes we do not collect |
| Size Guide | dropped | no size-guide content on the product, the option, or anywhere else. The modal would open on nothing |
| Sold-out bell / stock alert | dropped | back-in-stock needs a subscription table. The `notification` module can *send*, but nothing records who asked |
| Wishlist | dropped | no customer favourites table, and no `customer` column that could stand in |
| PayPal Pay-in-4, Klarna, Afterpay, Sezzle | dropped | `modules/payment/providers/` holds exactly one provider: `system`, "Manual Payment", `isTestOnly = true`. Same finding as `04-footer.md`'s payment strip, and here it would be a financing claim rather than a logo |
| Loyalty / "earns 256XP" | dropped | no loyalty module, no points column |
| "Free Standard Delivery over $75" / "Express Available" | dropped | shipping options are resolved per-address at checkout (`/store/carts/[id]/shipping-options`); there is no threshold, and no way to name one before the cart has an address |
| "Get The Look" rail | dropped | no product-to-product relation of any kind |
| "We Recommend" rail | dropped | no recommendations, and no signal to build one from |
| "Delivery & Returns" accordion | **blocked** — see below | the returns policy does not exist |
| "Share" | deferred — see below | needs no backend, but it is a feature, not a redesign |
| Description / "Designed For" tabs | **collapsed to one** | `product.description` is a single `text` column. There is no short/long pair and no feature-block content model |
| Social-proof pill ("1.2k viewed") | dropped | there is no view counter. A number here is not a placeholder, it is a claim |
| Image zoom | deferred | needs a lightbox; nothing blocks it but nothing here needs it either |
| Reviews section | dropped | as above |

The two rows in bold are the reason this page is not simply a subtraction: the specs table and the
quantity stepper are places where the catalogue holds *more* than the reference shows, and the
redesign keeps both.

## Decisions

**Everything below the buy panel is deleted, and the page ends at the specs table.** The reference
PDP is 6403px tall and the buy panel ends at 1540 — 76% of that page is tabs, two product rails and
a review system, and we can back none of it. What is left is one description and four spec rows, and
a tab strip with one tab is not a tab strip. The rejected alternative was keeping a `Tabs` shell with
`Description` as the only trigger against the day a second tab arrives: a control that cannot be
operated is worse than no control, it takes a focus stop and announces a tablist of one.

**The page stays inside `max-w-350`; the gallery bleeds to the edge only below `lg`.** The reference
gallery starts at `x: 0` and runs 720px — half the 1440 viewport — while its own
`--fds-size-container-max-width` is 1400px, so the PDP is the one page where it ignores its own
container. Reproducing that ties the gallery's width to the viewport while every other surface we
have shipped is capped: at 2560 it would be 1280px of photograph beside a 410px panel stranded in
white. Below `lg` the carousel does bleed, because a snap carousel with gutters snaps to a position
that looks like a mistake. The rejected alternative — negative margins escaping the container on
desktop too — buys the reference's exact look at 1440 and nothing above it.

**Colourways are option values on one product, not sibling products.** The reference's seven swatches
are seven `<a>` elements pointing at seven separate product pages; ours are values on a `renderAs:
'swatch'` option, switched with `?variant=` on the same route. That is not a shortfall — it is a
better model for a shopper, because the size selection survives the colour change, which is exactly
what `buildPickerTargets`' overlap scoring exists to guarantee ("switching Size does not silently
change Colour"). The swatch *treatment* is borrowed; the navigation is not. Keeping `?variant=` also
keeps the page shareable at a colourway, which `$productId.tsx` already documents as the reason the
param exists.

**Swatches become 4:5 rectangles.** The current `rounded-full size-11` disc crops a model shot to a
44px circle in which the only surviving information is an average colour — and the catalogue stores
no colour value, only `swatchImageUrl`, which is "the first image of the first variant carrying it",
i.e. a photograph. A 48×60 tile at the same ratio as the gallery shows the garment. The rejected
alternative was a true colour dot, which would need a hex column on `ProductOptionValue` that does
not exist and that no admin surface could fill.

**Sold out and never-offered collapse to one treatment, and the bell goes.** The reference draws
these as two states: a struck-through size with a bell is a size that exists and can be watched; a
size not offered is not rendered. We cannot draw that distinction, because `buildPickerTargets`
returns `null` for both cases — `option-combinations.ts:170` filters out candidates where
`inStock === false`, and a value with no candidate at all also lands at `null`. From the response
alone the two are indistinguishable at the point of render. Reconstructing it client-side means
re-implementing the prefix-matching walk in the browser, which is the exact duplication ADR 0015
(server-computed option projections) exists to prevent. So both stay struck through and disabled,
which is what ships today. The bell is dropped regardless: it promises a notification nothing can
send.

This is worth a backend ticket eventually — `pickerTargets` could carry `'unavailable' | null`
instead of `null` alone — but it is not this ticket, and until then one honest state beats two
guessed ones.

**The picker becomes radio groups.** Today each value is a `<button aria-pressed>`, which is a toggle
button that happens to be used for single-select: arrow keys do nothing, every value takes its own
tab stop, and screen readers announce seven independent pressed/unpressed toggles rather than one
choice of seven. The reference uses a visually-hidden `<input type="radio">` behind a styled
`<label>`, and that is the right shape here too — roving focus, arrow-key traversal and
`disabled` skipping all come free from the platform — but only once every input in one option shares
a `name`, which is what makes the browser treat them as one group at all. `name={option.id}` (ids are
unique per product, `entities.ts:43`), which means `TextValue` and `SwatchValue` take the option id
alongside the four props they take today. `getByRole('radio', { name })` is already the established
selector in `checkout.spec.ts:58`, so the e2e vocabulary does not change either.

Visually hiding the input takes the focus ring with it, and that has to be put back explicitly:
`variant-picker.tsx:87` and `:108` both carry `focus-visible:outline focus-visible:outline-foreground`
today, and a `sr-only` input paints nothing. The label is the `peer`, styled with
`peer-focus-visible:outline peer-focus-visible:outline-ink` — the same peer mechanism
`components/input.tsx:43` uses to drive its floating label off the input's state. Nothing else in
`apps/store/src` uses a native radio, so this is the pattern's first use and the ring is the part
that does not come free.

Native inputs rather than `RadioGroupItem` from `@proteus/ui`: that primitive is a 16px round dot
with a border, an indicator span and a `data-checked` fill — using it for a 52px bordered grid cell
means overriding every class it ships and then hiding the dot. The checkout forms want the dot; this
does not.

**The thumbnail rail is replaced by a dot row, and the state moves rather than disappearing.** The
mosaic and the carousel both show every image, so there is nothing left to navigate *to* on desktop
and `activeImageId` has no meaning. But deleting the rail outright takes random access away from the
phone, where the carousel is the whole gallery and nothing on screen says how many photos there are.
The dots restore both: they are the length indicator and they are clickable. The state changes shape
— from "which thumbnail did you click" to "which slide are you on", read as
`Math.round(scrollLeft / clientWidth)` on scroll — but it does not go away, and the component does
not get simpler. Pretending it would is how the missing affordance gets shipped.

**The description stays below the buy controls.** The reference puts a two-line teaser above the
swatches and the full text below the fold; we have one `text` column doing both jobs, and an
unbounded description above the size picker pushes Add to cart off a phone screen. The rejected
alternative was `line-clamp-2` with an expander: that invents a truncation the catalogue never asked
for, and on an SSR'd route (`ssr: true`, with `ensureQueryData` in the loader) it hides the page's
only prose from anything that reads the markup.

**The buy panel stays sticky; the gallery does not.** The reference does the opposite — the gallery
is `position: sticky; top: 100px` and the panel scrolls — which is right for a page whose left
column is short relative to 6403px of content below. Ours is inverted: the gallery grows with the
image count and the panel is the entire rest of the page, so a sticky gallery would pin a short
column against a shorter one and leave white space in both. `lg:sticky lg:top-24` is what ships
today and it stays; the header is `lg:h-20`, so 6rem clears it by 16px.

**The mobile action bar is pinned from first paint, not revealed on scroll.** The reference's bar is
`position: fixed; bottom: 16px` at scroll 0, with a transparent wrapper — the ink button is opaque
and does its own separating, so there is no scrim and no bar chrome. Revealing it once the inline
button scrolls away is the more common pattern and it is rejected here for two reasons: it needs a
scroll observer, and it means the primary action is missing from the first screen of the page whose
entire job is that action.

Mechanically it is the same `AddToCart` component with a wrapper that is `fixed` at the base and
`lg:static` — one DOM node, one CSS switch, no second tree, which is the constraint `spec.md` sets
for cross-breakpoint structure changes.

**The `<Toaster />` lane has to move, and that is a change outside this component.** `packages/ui`'s
toast viewport is `fixed inset-x-4 bottom-4 z-99` below `sm`, which is the same 16px lane the action
bar takes, at a z-index above it. The one toast this page can produce is the add-to-cart failure
from `useAddLineItem` — so on the phone, a failed add covers the button you press to retry it with
the message telling you to.

Fixing it needs a `packages/ui` change, which is not what it first looks like. `Toaster`
(`toast.tsx:168`) takes `ToastPrimitive.Provider.Props` and renders `<ToastViewport>` with **no props
at all**, so the viewport's classes are unreachable from the store. Recomposing
provider/portal/viewport in `__root.tsx` is blocked too: `ToastProvider`, `ToastPortal` and
`ToastViewport` are all exported but `ToastList` is not (`toast.tsx:184`).

So: **`Toaster` gains an optional `viewportClassName`, forwarded to `ToastViewport`.** It is purely
additive — admin passes nothing and renders exactly as it does today — which is the same rule
`04-footer.md` established for `packages/ui`: adding to it is safe, and only its `:root` is off
limits. `__root.tsx:73` then passes `bottom-20 lg:bottom-4`, which is also what the cart drawer's
pinned footer wants.

Rejected: exporting `ToastList` and hand-composing the four primitives in the store — that copies
`Toaster`'s body into the app, so the next change to the toast stack has to be made twice. Also
rejected: moving the lane inside `packages/ui` for both apps — the admin has no bottom-pinned bar,
and lifting its toasts 64px to solve a storefront problem is a change to a surface this ticket has
not looked at.

**The breadcrumb stays, retokenized.** The reference has none, because it has a mega-nav and a
category tree to go back to. We have neither: `/products` is the only listing, and the breadcrumb is
the only link back to it from a PDP reached by search or by link. The hand-rolled
`text-xs uppercase tracking-[0.18em]` goes; it becomes plain `text-xs text-ink-muted` — the
reference's meta role (400 · 12px · muted, `reference.md:48`) with no hand-rolled tracking on top.
`03-header.md` and `04-footer.md` both resolved their own micro-labels into a *display role*
(`type-heading`, `footer.tsx:87`); the breadcrumb is not one, so it lands on the meta role instead.

## Work

- **`features/products/components/product-gallery.tsx`** — rewrite. One `<ul>`, two layouts, no
  duplicated tree.

  Base is the carousel: `flex snap-x snap-mandatory overflow-x-auto` on the list,
  `w-full shrink-0 snap-start` on each `<li>`. At `lg:` the same list becomes
  `lg:grid lg:grid-cols-2 lg:gap-1 lg:overflow-visible` and `shrink-0` / `snap-start` go inert.

  The mosaic rhythm is `[half, half, full]` repeating — measured off the reference as images 1 and 2
  at 358px side by side with a 4px gap, image 3 at 720px full width, image 4 at 358px. Every third
  image spans, and so does a trailing image that would otherwise sit alone in the left column:

  ```
  const isWide = index % 3 === 2 || (index === images.length - 1 && index % 3 === 0)
  ```

  Verified across counts: 1 → wide (a lone image is not half a row); 2 → pair; 3 → pair + wide;
  4 → pair + wide + wide; 5 → pair + wide + pair; 6 → pair + wide + pair + wide. There is no count
  that leaves an orphan. `isWide` applies under `lg:` only.

  What must survive from the file being replaced:
  - the empty state — no images and no thumbnail renders the `PackageIcon` tile on `bg-surface-subtle`.
    Ratio changes `aspect-3/4` → `aspect-4/5`.
  - the `thumbnail` fallback — `images` empty but `thumbnail` set renders the thumbnail as the only
    slide. This is a live branch: `variant.imageIds` is empty for any variant with no image links.
  - **the gallery opening on the variant's own photo.** `thumbnail` does two jobs, as the prop's own
    comment says, and only the second one is obvious. `:17-18` resolves the active image as
    `images.find((image) => image.url === thumbnail)`, which matters precisely when the variant has
    *no* image links: `product-detail.tsx:29-30` then falls back to the whole product gallery, and
    without this line a red variant would open on the black variant's first photo. It survives as the
    carousel's initial index — `images.findIndex((image) => image.url === thumbnail)`, defaulting to
    0 — scrolled to on mount and on variant change. Dropping it would be a silent regression on
    exactly the catalogue shape the seed produces.
  - the fade on variant change. It is currently `key={activeUrl}` on the hero. With no hero, key the
    `<ul>` on the selected variant id so the whole strip replays rather than hard-swapping.
  - random access to a specific image, which the thumbnails provided. It returns as the dot row.
  - `fetchPriority="high"` on the first slide only, and `loading="lazy"` on the rest — today the hero
    has it and the thumbnails do not, and in a carousel every slide is a full-size image.

  What changes: `activeImageId` becomes `activeIndex`, set from `onScroll` as
  `Math.round(scrollLeft / clientWidth)`, and the dots call `scrollTo({ left: index * clientWidth })`.
  The scroller takes `tabIndex={0}` and an `aria-label` — a scrollable region must be reachable by
  keyboard, and the dots alone do not make it so.

  Alt text: today the hero carries `alt={product.title}` and the thumbnails carry `alt=""`, which is
  right when the thumbnails are navigation. In a carousel every slide is content. `StoreProductImage`
  has no alt column, so the honest fallback is positional — `${alt} — view ${i + 1} of ${n}` — and
  this is the assertion in `products.spec.ts` that has to move with it. See Constraint.

- **`features/products/components/gallery-dots.tsx` (new)** — the indicator. Renders nothing for a
  single image. Dots are `<button>`s with `aria-label={`Show image ${i + 1}`}` — the label the
  thumbnails already used, kept verbatim so the vocabulary does not drift — `aria-current` on the
  active one, 44px tap targets around an 8px mark. `lg:hidden`: the mosaic shows everything, so an
  indicator there indicates nothing.

- **`features/products/components/variant-picker.tsx`** — rewrite the two value components, keep the
  routing logic untouched. `pickerTargets`, the `target === selectedVariant.id` selection test, the
  `target !== null` availability test and the `VariantSelect` fallback all stay exactly as they are;
  this is a rendering change.

  `TextValue` → a size cell: a visually-hidden `<input type="radio">` plus a `<label>` at
  `h-13 border border-line px-2 py-1 text-xs uppercase` with `flex items-end justify-start`, which is
  what puts the label bottom-left in the cell. Selected is `bg-ink text-surface font-bold`;
  unavailable is `text-ink-muted line-through` with the input `disabled`. The grid is
  `grid grid-cols-4 gap-0` — zero gap is the point, the 1px borders meet and the group reads as one
  table rather than four buttons. Four columns at every width; the reference does not collapse them
  and neither do we.

  `SwatchValue` → a colour tile: `w-12 aspect-4/5 border-2` — `border-ink` selected,
  `border-transparent` otherwise, so nothing shifts when the selection moves. Same hidden-radio
  construction, `aria-label` on the input carrying the value name. The `bg-surface-subtle` initials
  fallback stays for a value with no `swatchImageUrl`, retokenized off `--bg-subtle`.

  The legend loses its inline colour name. Today `Colour` and `Heavy Blue` share one `<legend>` with
  the value in a nested `<span>`, which makes the group's accessible name change every time the
  selection does. The name moves below the strip as its own `text-xs text-ink-subtle` line, where the
  reference puts it, and the legend keeps just the option title.

  Both legends drop `text-xs uppercase tracking-[0.18em]` for the reference's plain 14px ink — this
  is the "Select a size" measurement. `VariantSelect`'s `Variant` label (`variant-picker.tsx:136`)
  is the fourth site carrying the same hand-rolled string; it drops it too and lands on
  `text-xs text-ink-muted`, matching the breadcrumb. Label text and `htmlFor` are unchanged — see
  Constraint.

  For a `renderAs: 'text'` option that is *not* sizes — the catalogue does not constrain this — the
  4-column grid still holds. Long values wrap inside a 52px cell rather than widening it, which is
  why the cell is `px-2 py-1` and `items-end` rather than centred.

- **`features/products/components/add-to-cart.tsx`** — the wrapper becomes the action bar.
  `fixed inset-x-0 bottom-4 z-40 flex gap-2 px-4 sm:px-6 lg:static lg:z-auto lg:px-0`. `z-40` sits
  under the header's `z-50` (`header.tsx:18`), which is the right way round: the header is at the
  top and the bar at the bottom, so they never meet, and a bar that outranked the sticky header
  would be a bug waiting for a short viewport. The stepper and the button keep their current order;
  `flex-1` stays on the button only, as it is today (`add-to-cart.tsx:73`), so the stepper keeps its
  intrinsic width. On the phone this lands as [stepper][Add to cart], mirroring the reference's
  [Add to bag][wishlist] with our own second control in the slot theirs uses for one we cannot back.

  The button's `h-11` override goes. `add-to-cart.tsx:73` is `className="h-11 flex-1"`, which beats
  the store `Button`'s own `h-13 px-6` default (`components/button.tsx:16`) — and `h-13` is the
  52px the measured table maps this button to. Drop `h-11` and let the default stand; `flex-1`
  stays.

  The stepper has to reach 52px to sit beside it, and it cannot today. `QuantityStepper` defaults to
  `size='sm'` (`quantity-stepper.tsx:74`), and its `cellSize` map tops out at `md` / `size-10` /
  40px (`:20-24`). A 40px stepper against a 52px button leaves a 12px step in a bar whose two
  controls sit on one line — the reference's own are 54 and 54. So `cellSize` gains
  `lg: { button: 'h-12.5 w-13', count: 'w-9', glyph: 'size-4' }`, and the PDP passes `size="lg"`.

  > **Correction (2026-08-26).** This line first read `button: 'size-13'`, which overshoots. The
  > `boxed` frame is a `border border-line` on the wrapper, and the wrapper sets no height of its
  > own, so the control renders at *cell + 2px* — `size-13` would come out 54px against the
  > button's 52. The cells have to be 50px for the outer edges to agree, which is `h-12.5`, and the
  > width stays `w-13` because only the height has to match. The 52px target in the sentence above
  > is the one that matters and is unchanged.

  This is a store-local change — `QuantityStepper` lives in `apps/store/src/features/cart/`, not in
  `packages/ui` — and it is additive: the cart drawer and the cart page keep `sm`. The rejected
  alternative was passing the existing `size="md"` and accepting 40 against 52, which is the visible
  version of the same problem, just smaller.

  The no-variants branch must not become a floating empty strip: `product.variants.length === 0`
  returns the "isn't available to order yet" line *without* the fixed wrapper, as inline prose.

  `isPending` already disables and spins; that is the in-flight state and it is unchanged. `text-ink-muted`
  replaces the current `text-ink-muted` — already correct in this file, unlike its neighbours.

- **`features/products/components/product-detail.tsx`** — rewrite. Grid becomes
  `lg:grid-cols-[minmax(0,1fr)_25.625rem]` (410px panel, matching the measurement) with
  `lg:gap-38` (152px, against a measured 155). Order inside the panel: subtitle, title, price,
  swatches, colour name, sizes, add to cart, description, specs. `type-title` on the `h1`,
  `text-xs text-ink-subtle` on the subtitle, `font-bold` on the price. Tokens throughout —
  `text-ink-muted`, `border-line`, `bg-surface-subtle` — replacing every `text-(--foreground-muted)`,
  `border-border` and `bg-(--bg-subtle)` in the file. `pb-28 lg:pb-24` so nothing hides under the
  fixed bar.

  The not-found branch keeps its `<main>` and its copy, retokenized.

  Gallery bleed below `lg`: the `<main>` keeps `px-4 sm:px-6 lg:px-8`, and the gallery gets
  `-mx-4 sm:-mx-6 lg:mx-0`. Negative margins matched to the gutter rather than `100vw` tricks —
  `body` sets `overflow-x: hidden`, which would mask a 1px overflow rather than prevent it.

- **`features/products/components/product-specs.tsx`** — tokens only. `border-border` → `border-line`,
  `text-(--foreground-muted)` → `text-ink-muted`. The filtering logic is already doing the honest
  thing this ticket is about — rows with nothing behind them are dropped — and stays.

- **`features/products/components/product-detail-skeleton.tsx`** — rewrite to the new layout. It
  currently describes a thumbnail rail, a hero at `aspect-3/4`, circular swatches and a
  `lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]` split that the real page does not use even today.
  Every one of those is now wrong. Must match: one full-width `aspect-4/5` block below `lg`, the
  2-column mosaic above it, the 410px panel, a 4×2 size grid.

- **`routes/_main/products/$productId.tsx`** — unchanged. `ssr: true`, the loader, the headers and
  the `variant` search schema all stay.

- **`features/cart/components/quantity-stepper.tsx`** — add the `lg` entry to `cellSize`. Nothing
  else in the file changes, and no existing caller does either. See the add-to-cart bullet.

- **`packages/ui/src/components/ui/toast.tsx`** — `Toaster` gains an optional `viewportClassName`,
  forwarded to `ToastViewport`. Two lines, additive, no export changes. See the decision.

- **`routes/__root.tsx`** — pass `viewportClassName="bottom-20 lg:bottom-4"` to the `Toaster` at
  `:73`, so the toast lane clears the action bar on the phone.

## Responsive

Written phone-first: the base classes are the phone, `lg:` adds.

**Base (phone).** The gallery is a full-bleed snap carousel at 4:5 — one slide per viewport, no
peek, no gutter — with the dot row centred beneath it. Then the panel content in one column inside
the page's `px-4` gutter: subtitle, title at 24px, price, swatch strip (wrapping, not scrolling — at
390 the content box is 358px, so seven 48px tiles with `gap-2` wrap to six and one; that is the
correct outcome, not a fit to preserve), colour name, the 4-column size grid at ~89px cells,
description, specs.

The action bar floats at `bottom-4` over all of it, from first paint. The page carries `pb-28` so
the specs table's last row clears it.

**`sm:`.** Gutter to `px-6`. Nothing else moves — the carousel is still right at 640px, and the size
grid's cells simply get wider.

**`lg:` and up.** Three things change together: the carousel becomes the two-column mosaic, the
action bar unpins to `lg:static` inside the panel, and the page becomes
`[gallery | 410px panel]` with the panel `lg:sticky lg:top-24`. The dot row is `lg:hidden`.

What deliberately does not change: the size grid is four columns at every width, the swatch tiles are
48×60 at every width, and the image ratio is 4:5 at every width. Those three are the page's
proportions, not its layout, and a proportion that changes with the viewport is a different design at
each end.

Tap targets: size cells are 52px tall and roughly a quarter of the content width — the largest
targets on the page, which is right for the control that gets the most mistaken taps. Swatch tiles
are 48×60 and clear 44px on both axes on their own. Dots carry 44px hit areas around an 8px mark.

## States the reference cannot show you

- **Cold entry.** The route is `ssr: true` with `ensureQueryData` in the loader, so a direct hit
  arrives with the product in the markup and the skeleton never shows. A client-side navigation from
  the PLP with a cold cache does show it, which is the case the rewritten skeleton exists for. It
  must describe the *new* layout — the current one describes a thumbnail rail that will not be there,
  and a skeleton that resolves into a different shape is worse than no skeleton.
- **Unknown `?variant=`.** Already handled and already commented: the lookup falls back to
  `product.variants[0]` rather than erroring. Unchanged, and it is what makes the shareable-colourway
  URL safe to hand-edit.
- **Product not found.** `useSuspenseProduct` resolves with no product → the bare "Product not found."
  line. Kept, retokenized. Not an error boundary, and not changed here.
- **No variants at all.** `AddToCart` returns prose instead of a button. The fixed wrapper must not
  render around it — see Work. This is the branch most likely to be missed, because it never appears
  on seeded data.
- **No images.** `PackageIcon` on `bg-surface-subtle`, one 4:5 tile, no dots, no scroller. The dot
  row already returns `null` below two images, so this falls out.
- **One image.** Carousel of one: `overflow-x-auto` with nothing to scroll to, no dots. On `lg:` the
  `isWide` rule makes it span both columns rather than sitting at half width.
- **In flight.** `addLineItem.isPending` disables the button and swaps in `Loader2Icon`. Unchanged.
  On the phone this is happening in a bar pinned over the page, which is more visible than it is
  today, not less.
- **Failure.** `useAddLineItem` toasts. See the `Toaster` lane decision — this is the state the
  collision breaks.
- **Success.** `onSuccess` opens the cart drawer (`setCartOpen(true)`), per `07-cart-drawer.md`. The
  drawer covers the action bar on the phone, which is fine: the panel is the confirmation.
- **Long title.** `type-title` runs `line-height: 0.9` uppercase; three lines at 32px is 86px, which
  the panel absorbs. No clamp — truncating the product's name on the product's own page is not a
  trade worth making.
- **Many sizes.** The grid wraps to more rows with the borders still meeting. Twelve values is three
  rows and reads fine; the reference's own run is seven.
- **Many colours.** The swatch strip wraps. It does not become a scroller: a horizontally scrolling
  strip inside a vertically scrolling page, next to a horizontally scrolling gallery, is two swipe
  gestures on one screen that mean different things.
- **A sold-out variant reached directly.** `buildPickerTargets` deliberately keeps the selected
  variant selectable even when `inStock === false` ("so the picker still shows what they are looking
  at"). The cell renders selected *and* struck through, which is the correct and slightly odd-looking
  answer. Do not "fix" it.

## Blocked, and tracked elsewhere

**Delivery & Returns.** Needs a returns policy, and `.tasks/next-todos:98` records that no privacy
policy, terms or returns policy exists and that nothing can go live without them — the same blocker
that keeps the legal row out of the footer. The accordion is omitted until those routes land, at
which point it is a link, not new content.

**Share.** Needs no backend — `navigator.share` with a copy-link fallback and a toast — and it is
left out anyway, because it is a feature being introduced under cover of a redesign. It belongs in
its own ticket with its own decision about the desktop fallback. Recorded here so it is not mistaken
for an oversight.

**Image zoom.** Same shape: nothing blocks it, and a lightbox is not a token change. Deferred with
Share.

**`pickerTargets` cannot distinguish sold-out from never-offered.** Recorded in the decisions above.
The fix is in `buildPickerTargets` and it changes a response shape, so it is a backend ticket, not a
line in this one. Until then the collapsed treatment is what ships.

## Constraint

`apps/store/tests/e2e/products.spec.ts` is the file. Six tests, and the DOM under three of them
changes — `gallery follows the selected variant` (:187), `renders a picker per option and follows
the selection` (:206) and `a combination no variant covers is disabled` (:228).

**Must keep working, unmodified:**

- `getByRole('heading', { name: product.title })` — the `h1` stays an `h1`. `type-title` sets
  `text-transform: uppercase`, which is presentational and does not change the accessible name.
- `getByText(product.description)` — the description stays rendered in full and stays visible. This
  is the assertion the "no `line-clamp`" decision protects; if a future pass adds an expander, this
  test is what should fail.
- `getByLabel('Variant')` and `.selectOption(...)` — the `VariantSelect` fallback for products whose
  variants carry no option values. Two tests depend on it. It is retokenized, not replaced, and it
  keeps the label `Variant` and the id `variant-select`.
- The `?variant=` URL assertions — `toHaveURL(new RegExp('variant=' + id))`. The navigation contract
  is untouched.

**Legitimately breaks, with the replacement:**

- `getByRole('button', { name: 'S', exact: true })` → `getByRole('radio', { name: 'S', exact: true })`.
  Two occurrences, lines 217 and 241.
- `toHaveAttribute('aria-pressed', 'true' | 'false')` → `toBeChecked()` / `not.toBeChecked()`.
  Three occurrences. `aria-pressed` does not exist on a radio and asserting its absence would pass
  vacuously — which `assertions-must-be-able-to-fail` is exactly about.
- `getByRole('button', { name: 'White' })` → `getByRole('radio', { name: 'White' })`. Two
  occurrences — line 218, where it is bound to `white` and reused three times, and the
  `toBeDisabled()` at line 239. `disabled` moves from the button to the
  hidden input, and `toBeDisabled()` still holds.
- `getByRole('img', { name: catalog.product.title })` with `toHaveAttribute('src', …)` — two
  locators (lines 198 and 225) behind three assertions (199, 203, 225), and the one that needs
  thought. Today exactly one image carries the title as its
  accessible name; in a carousel every slide is a titled image, so this becomes a strict-mode
  violation on any product with more than one photo. It also stops meaning what it meant: there is no
  hero, so "the main image's src" is not a thing to assert.

  The tests using it are asserting that *the gallery follows the variant* — that selecting White
  shows White's photo. With positional alt text the direct replacement is
  `getByRole('img', { name: new RegExp(`^${escape(title)} — view 1`) })`, but a cleaner assertion for
  what these tests actually mean is to scope to the gallery and assert the set:

  ```
  await expect(gallery.getByRole('img')).toHaveCount(1)
  await expect(gallery.getByRole('img').first()).toHaveAttribute('src', catalog.white.url)
  ```

  Both colourways in `createProductWithColourways` have exactly one image, so the count is the
  stronger claim: it proves the *other* variant's photo is gone, which the current `src` check does
  not. Pick one, but do not reach for `.first()` alone against a multi-image product — that passes
  the day the filter breaks and leaves every image mounted.

**Worth adding, because it is new behaviour with logic in it:** one test at a phone viewport that the
gallery dots move the carousel — click dot 2, assert the second slide is the one in view. That is the
only piece of this page that is not a pure render, and it is the piece that replaces the thumbnail
rail's job. It has to set the viewport itself: `playwright.config.ts:15-18` declares one project,
`devices['Desktop Chrome']`, so every other spec in the suite runs at 1280 and the dots are
`lg:hidden` there.

`cart.spec.ts` and `checkout.spec.ts` both start their flows on a PDP and click Add to cart. Neither
selects a variant or touches the gallery — they navigate, add, and move on — so neither should need
a change. Run them anyway: `cart.spec.ts:111` asserts the URL is exactly
`/products/{id}?modal=cart`, which is sensitive to any stray search param, and this ticket is one of
the few that could introduce one by accident.
