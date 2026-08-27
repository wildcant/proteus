# Reference system

Extracted 2026-08-24 by reading `:root` custom properties and `getComputedStyle` off the live
reference storefront (home, men's PLP, login). Its tokens are namespaced `--fds-*` (semantic primitives) over
`--global-*` (raw values). Recorded here so later passes — nav, PLP, PDP, cart — do not have to
re-scrape it.

This is a reference, not a target to clone. Where we diverge, `spec.md` says why.

## Colour

Their black is `#0d1012`, not `#000000`. Everything in the system sits on it.

| Role | Value | Their token |
|---|---|---|
| Ink | `#0d1012` | `--global-color-neutral-black` |
| Surface | `#ffffff` | `--fds-color-surface-default` |
| Surface subtle | `#f4f5f6` | `--fds-color-surface-subtle` |
| Line | `#dee0e3` | `--fds-color-border-default` |
| Text muted | `#767a7f` | `--fds-color-text-muted` |
| Text subtle | `#9fa3a8` | `--fds-color-text-subtle` |
| Text disabled | `#bec2c6` | `--fds-color-text-disabled` |
| Sale / error | `#dc0428` | `--fds-color-text-sale` |
| Positive | `#009966` | `--fds-color-feedback-positive` |
| Accent | `#004eba` | `--fds-color-text-accent` |

They publish high-contrast dark variants for the two feedback hues even though the site itself is
light-only: `--global-color-red-hc-dark: #ff8fa5`, `--global-color-green-hc-dark: #00e890`.

## Radius

`--fds-radii-angled: 0`. Measured on live buttons, inputs and product images: `border-radius: 0px`.
Square is the system, not an override. (`--fds-radii-softened: 0.4rem` and `--fds-radii-relaxed:
10rem` are declared but not used on the surfaces we sampled.)

## Type

Their rem base is 10px, so `1.4rem` = 14px. Converted to a 16px base:

| Role | Their token | Weight / size / leading |
|---|---|---|
| Display | `--fds-type-display-fluid` | 800 · clamp(32px, 48px) · 0.9 |
| Title | `--fds-type-title-fluid` | 800 · clamp(24px, 32px) · 0.9 |
| Heading | `--fds-type-heading-fluid` | 500 · 18–20px · 0.94 |
| Callout | `--fds-type-callout-base` | 400 · 18px · 1.4 |
| Body | `--fds-type-body-base` | 400 · **14px** · 1.4 |
| Body emphasis | `--fds-type-body-emphasis` | 700 · 14px · 1.4 |
| Meta | `--fds-type-meta-base` | 400 · 12px · 1.3 |

Body runs at 14px, not 16px. That is what makes their pages read dense and utilitarian.

Faces: a custom **Plaak** cut (display, 500/800) against **SN Skandia** (body, 400/700). Both
proprietary. They also ship Anton, Druk Condensed Super, Bebas Neue, Montserrat and Roboto as
fallbacks.

## Components, as measured

**Button** — live "Load more": `bg #0d1012`, `color #fff`, `radius 0`, `padding 16px 24px` (52px
tall), 14px. Labels are **title case** ("Log In", "Load more"). Uppercase is reserved for the
display roles and small eyebrow labels — that separation is how one system carries two voices.
Secondary is a 1px ink border on transparent.

**Input** — 1px `#dee0e3`, radius 0, ~56px tall, floating label that rests at placeholder position
and shrinks to the top **inside** the box (no border notch). Focus moves the border to ink.
Password fields carry an inline-end reveal toggle. Search input is filled `#f4f5f6`, no border.

**Product card** — 4:5 image (`object-fit: cover`, radius 0), then title at 14px and price at 14px.
No border, no shadow, no card chrome.

**PLP grid** — measured 2026-08-26 at four widths. `gap: 24px 4px` at every one; the near-zero
column gap is deliberate: images almost touch, so the page reads as a contact sheet rather than a
set of cards.

| | 390 | 768 | 1024 | 1440 |
|---|---|---|---|---|
| Columns | 2 × 185 | 3 × 248 | 3 × 219 | 4 × 247 |
| Page gutter | 8px | 8px | 40px | 40px |
| Filter rail | hidden | hidden | 240px | 320px |
| `h1` | 32.25px | 37.92px | 41.76px | 48px |

Their display clamp resolves to the same values our `type-display`
(`clamp(2rem, 1.65rem + 1.5vw, 3rem)`) does — 37.92 and 41.76 agree to the hundredth of a pixel.

**PLP card** — 4:5 image, then a details block padded 16px above `lg` and `8px 0` below it. Inside:
title 14px/400 ink, fit line 14px/400 `#767a7f` at `margin-top: 4px`, colour name the same, price
14px/**700** at `margin-top: 16px`. Two `<img>` stacked absolutely for the hover swap, a 44×44
wishlist button inset at the top right, and a badge pill (`#f4f5f6` on ink, `padding: 5px 8px`)
overlaid at the image's bottom left.

**PLP header** — muted eyebrow ("mens", 12px), huge display title ("ALL PRODUCTS"), result count,
then a one-line description, on a 24px rhythm. Left filter rail with hairline dividers; eleven
groups, `Sort By` first and open by default, each trigger 14px/400 capitalize with a chevron, each
option row 44px with the label at 14px `#767a7f` and a 24px left inset. Below `lg` the rail
collapses into a `position: sticky` bar carrying `sort`, the result count and `filter`, and the
count leaves the page header to sit in it.

**PLP pagination** — `Load more` (52px ink), `view all` below it, then "Viewing 1 - 60 of 1066
products" in 14px `#767a7f`.

**Login** — centered ~448px column on bare white. No card, no border, no panel; the form floats.

## Spacing

`--global-spacing-*`: 2 / 4 / 8 / 16 / 24 / 40 / 64 / 80 / 120 (at 10px base, so 2px…120px). Named
semantically as `--fds-spacing-detail-*` (fine/tight/next/close/near), `--fds-spacing-separator-*`
(related/distant), `--fds-spacing-feature-*` (relaxed/removed).

Container max width `--fds-size-container-max-width: 140rem` (1400px) — which is what the store's
existing `max-w-350` already is.
