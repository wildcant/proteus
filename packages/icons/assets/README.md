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

**The viewBox must be `0 0 24 24`.** The runtime supplies its own root attributes and does not read
the source viewBox, so an asset drawn on a different grid renders cropped or adrift with no error.
This is the one requirement nothing checks for you — verify it before dropping a file in.

**Solid fills, not strokes.** The runtime paints `fill="currentColor"` on the root and sets no stroke
geometry, which is what lets a caller tint a mark with `text-*` and get dark mode for free. A stroked
outline drawn with `fill="none" stroke="…"` will not tint, and will usually not show up at all.

**A `<title>` is optional and never rendered.** The generator lifts it out and uses the text for the
component's JSDoc; leaving it in the icon node would emit an empty `<title>` and give every mark a
blank accessible name. Callers pass their own `title` prop when a mark needs announcing — with none,
the component renders `aria-hidden="true"` and stays decorative.

**Two identical children in one file is an error.** Almost always a copy-paste slip, so the build
stops instead of shipping a duplicated path.

## What is here today

Both sets below came from [simple-icons](https://github.com/simple-icons/simple-icons), fetched from
`https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/<slug>.svg` on 2026-08-25. That is where this
batch happens to come from, not a constraint on what may be added.

### payment/

`visa` · `mastercard` · `americanexpress` · `paypal` · `applepay` · `klarna`

Klarna is generated but unused — kept for whenever BNPL lands. The store reference also shows
Afterpay and Sezzle; Afterpay is the same BNPL case, and Sezzle is not in simple-icons at all.

### social/

`instagram` · `facebook` · `x` · `tiktok` · `youtube` · `pinterest`

The reference also carries Discord, which is specific to its own community programme.

Note that `XIcon` collides with lucide's `XIcon`, its close icon. Alias one of them in any file that
needs both.

## Licensing

Whatever goes in here has to be something we may redistribute — check before adding, because these
files are committed and ship in the bundle.

The simple-icons files are **CC0 1.0**. The marks they depict are trademarks of their respective
owners and are usable only to identify the brand in question, which is exactly what a payment strip
and a social row do.
