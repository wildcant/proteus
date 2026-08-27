# Icon assets

Source SVGs for `@proteus/icons`. Anything can live here — a brand mark, an icon drawn in-house, one
lifted from an open set — as long as it meets the contract below. Subdirectories are organisational
only and carry no meaning to the build.

`npm run --workspace=@proteus/icons build:icons` walks this tree and writes one React component per
file into `packages/icons/icons/`, plus a barrel. That output is generated and committed; edit the
SVG here and regenerate rather than touching it.

## The contract

**The filename is the export name.** `visa.svg` becomes `VisaIcon`. The name is PascalCased on any
non-alphanumeric boundary, so `american-express.svg` gives you `AmericanExpressIcon` while
`americanexpress.svg` gives you the less readable `AmericanexpressIcon` — hyphenate multi-word names.

**Basenames must be unique across the whole tree.** Output is flat, so `payment/foo.svg` and
`social/foo.svg` would overwrite each other. The generator throws rather than letting one win.

**The geometry must fit its declared viewBox.** The root's `viewBox` is carried through to the
component, so an asset on a different grid scales rather than crops. Nothing checks that the artwork
actually fills the box it declares, though — verify that before dropping a file in.

Artwork that is not square is the awkward case, because the root box is. Wrap it in a `<g>` with a
fitting transform rather than rewriting every coordinate. All three payment badges are 100×60 and
share the same one: `transform="translate(0,4.8) scale(0.24)"` — `0.24` takes 100×60 down to 24×14.4,
and `4.8` centres that band in the 24-tall box. The generator preserves groups and their transforms,
so the fit survives regeneration.

Prefer the `0 0 24 24` box even when a transform is what gets you there: every other mark is on that
grid, so a stray one makes `size` mean something different for one icon than for the rest.

**The root's paint is yours; declare it there.** Attributes on the source `<svg>` — `fill`, `stroke`,
`stroke-width`, `viewBox` — land on the rendered root, over the runtime's defaults and under the
caller's props. Declare nothing and you get `fill="currentColor"` and no stroke, which is what a
solid mark wants. An outline mark declares `fill="none" stroke="currentColor" stroke-width="…"` and
keeps it.

Paint with `currentColor` wherever you can: it is what lets a caller tint a mark with `text-*` and
get dark mode for free. An asset may carry fixed colours instead, and every `payment/` badge does.
The trade is that it opts out of tinting entirely — `text-*` on the caller is a no-op and the mark
does not follow the colour scheme. Right for a card scheme, which is only recognisable in its own
colours; wrong for anything the design system is meant to paint, which is why `social/` stays on
`currentColor`.

Four root attributes are the runtime's and are dropped rather than merged: `xmlns`, `width`/`height`
(the `size` prop sets those), `class` (it would fight the caller's), and `role`/`aria-*` (a mark is
decorative unless the caller passes a `title`).

**A `<title>` is optional and never rendered.** The generator lifts it out and uses the text for the
component's JSDoc; leaving it in the icon node would emit an empty `<title>` and give every mark a
blank accessible name. Callers pass their own `title` prop when a mark needs announcing — with none,
the component renders `aria-hidden="true"` and stays decorative.

**Two identical children in one file is an error.** Almost always a copy-paste slip, so the build
stops instead of shipping a duplicated path.

## What is here today

The `social/` set came from [simple-icons](https://github.com/simple-icons/simple-icons), fetched
from `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/<slug>.svg` on 2026-08-25. That is where
that set happens to come from, not a constraint on what may be added.

The `payment/` set does not. Those are full-colour card badges added by hand and **their provenance
is not recorded** — see Licensing.

### payment/

`visa` · `mastercard` · `americanexpress`

The three schemes the footer strip shows. PayPal, Apple Pay and Klarna were dropped when the strip
moved to colour badges: the simple-icons monochrome versions no longer matched, and no colour
replacement has been sourced. Add them back as 100×60 badges if the strip should carry them.

### social/

`instagram` · `facebook` · `x` · `tiktok` · `youtube` · `pinterest`

The reference also carries Discord, which is specific to its own community programme.

Note that `XIcon` collides with lucide's `XIcon`, its close icon. Alias one of them in any file that
needs both.

### loose

`shopping-bag` — the header cart mark, a 1.5-weight outline from
[heroicons](https://github.com/tailwindlabs/heroicons) (MIT). The first asset here that is not a
brand mark, and the first stroked one.

## Licensing

Whatever goes in here has to be something we may redistribute — check before adding, because these
files are committed and ship in the bundle.

The simple-icons files are **CC0 1.0**. The marks they depict are trademarks of their respective
owners and are usable only to identify the brand in question, which is exactly what a payment strip
and a social row do.

The whole `payment/` set is the exception and is **not cleared**. None of the three is a
simple-icons file — they are colour card badges of unrecorded origin, and card-scheme badge sets
commonly carry their own terms. Establish where they came from and under what licence before the
storefront goes live, and record it here. This sits alongside the other launch gate on the payment
strip: the store advertises three schemes while `apps/backend/src/modules/payment/providers/` holds
only `system`, "Manual Payment", test-only.
