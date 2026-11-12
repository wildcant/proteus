# Brand rules for design work

What the storefront's look is, what it refuses, and what reviews taught. The designer subagent (`.claude/agents/designer.md`) reads this before every task. The decisions live in `PRODUCT.md` ("Brand Commitments"), the system in `DESIGN.md` and the tokens in `colour.md`; this file turns them into rules for drawing. When they disagree, `PRODUCT.md` wins: fix this file.

These rules describe the blueprint's own neutral look. A brand that forks the blueprint rewrites "The world in one paragraph" and the deliberate choices for its own identity, and keeps the structure of this file.

## The world in one paragraph

The White Wall: the product photograph is the work, the interface is the wall and the label. Ink on white, or white on near-black in dark. Square edges, hairlines, a two-step surface. One typeface in two voices: an ExtraBold uppercase display for the few words that name a page, a quiet 14 px sentence-case body for everything else. The interface keeps one hue, for the bag's count, and one red, for sale and destruction. It is drawn for a phone first and grows into columns on a desk.

## Deliberate choices that look like defaults

A neutral black-and-white shop with heavy uppercase headings is also what a generated store looks like. Here each choice has a job. Keep them, and keep them meaningful:

- **Neutral on purpose.** The interface has no brand tint so a fork's brand, and the photographs, are the first colour anyone sees. Surfaces are `surface` and `surface-subtle`; edges are `line`.
- **One hue, one job.** `color/accent` appears on the bag's count badge, with `surface` text. Nothing else is blue.
- **Red means money or loss.** `color/sale` marks a sale price, low stock, or an action that destroys something (remove, delete), always with words.
- **Uppercase is a role, not a style.** Only `type/display`, `type/title` and `type/heading` are uppercase. Buttons and links are title case; sentences are sentence case.
- **Square is the system.** Radius 0 on every card, button, field, panel and drawer. The pill is for a label laid over something: the sold-out badge, count badges, the avatar, gallery dots, the theme toggle.
- **Depth is a surface step and a scrim.** The one shadow lifts the bag's pinned footer; drawers get an 80 % black scrim with no blur.

## Refused looks

- A brand palette in the blueprint itself: tinted surfaces, a second hue, gradients.
- Rounded cards with soft grey shadows; glass, blur, glows.
- A display face beside Manrope, or a monospace for prices.
- Copying the reference's layout pixel for pixel, or naming it anywhere. Take the job a layout does.
- Desktop-first layouts undone on a phone.

## Copy

- The `en` Lingui catalog (`apps/store/src/locales/en.po`) is the copy. Draw its strings, not paraphrases; a string that doesn't exist yet is a question, not an invention.
- Product names, prices, options and images come from the seed data (`apps/backend/scripts/seed-dev.ts`). Where a state needs content the seed doesn't have, use a plain placeholder ("Product title"), never an invented product or price.
- Spanish runs longer: leave room for about 30 % more text on labels and buttons.
- Prices read "From $46" on a card when variants differ, as the store renders them.

## Banned patterns

| Don't | Do instead |
|---|---|
| `accent` on links, buttons or borders "for brand" | `ink` for actions, `accent` only on the bag's count |
| `sale` as a generic error tint | `sale` with words for sale, scarcity, destruction |
| Rounded cards, buttons, fields or panels | Square, with a pill only for an overlaid label |
| A shadow on a card, button or panel | The surface step and a hairline |
| Uppercase buttons, links or sentences | Title and sentence case; uppercase only in the `type/*` display roles |
| A hand-assembled heading (local size, weight and case) | A `type/*` text style |
| Text under 12 px | 14 px body, 12 px meta |
| A structure that switches by viewport in script | Stacked layouts or two layouts by CSS, drawn as `viewport` variants |
| Raw hex, `palette/*` or Tailwind default colours | `color/*` roles |
| An invented product, price or line of copy | Seed data and the `en` catalog |

## Lessons from reviews

From the code's own comments and the store design system spec (`.scratch/store-design-system/spec.md`). Each was a real defect.

- **A weak scrim** (store design system): the shared kit's 10 % scrim with a 4 px blur left the drawer and the page at the same depth, with a 1 px border doing all the work. The scrim is black at 80 %, no blur.
- **True black on photographs**: `ink` is #0D1012, because pure black read harsh against product images.
- **Three wordmarks** (store design system): every layout hand-rolled its own home link. One `Wordmark`, in `type/heading`.
- **A role's partner left behind**: repointing `--accent` without its foreground made a focused menu item near-black on blue. A role is checked with what sits on it, in both themes.
- **Card inset on a phone**: at a 4 px column gutter, insetting a card's text cost more width than it bought. Card text has no side inset on a phone.

## Approved exceptions

None yet.

## Adding a rule

When the owner corrects the same thing twice, add it here: the rule, the reason, and the date. Remove rules the owner reverses.
