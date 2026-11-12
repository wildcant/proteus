---
name: Proteus
description: The storefront's design system, drawn in the FigCraft design file and generated into code.
colors: { ink: "#0d1012", ink-muted: "#767a7f", ink-subtle: "#9fa3a8", ink-disabled: "#bec2c6", surface: "#ffffff", surface-subtle: "#f4f5f6", line: "#dee0e3", accent: "#004eba", sale: "#dc0428", positive: "#009966", warning: "#ffb86a", selection: "rgb(79 184 178 / 0.24)", shadow: "rgb(13 16 18 / 0.2)", field: "rgb(222 224 227 / 0)", outline: "#0d1012", focus-ring: "rgb(13 16 18 / 0.5)", surface-muted: "#f5f5f5", ghost-hover: "#f5f5f5", outline-hover: "rgb(13 16 18 / 0.05)", control: "#ffffff", sale-wash: "rgb(220 4 40 / 0.1)", scrim: "rgb(0 0 0 / 0.8)", scrim-dialog: "rgb(0 0 0 / 0.1)", field-disabled: "rgb(222 224 227 / 0.5)" }
typography: { display: { fontFamily: "Manrope", fontSize: "32px", fontWeight: 800, lineHeight: 0.9, letterSpacing: "-0.02em" }, title: { fontFamily: "Manrope", fontSize: "24px", fontWeight: 800, lineHeight: 0.9, letterSpacing: "-0.02em" }, heading: { fontFamily: "Manrope", fontSize: "20px", fontWeight: 800, lineHeight: 0.94, letterSpacing: "-0.01em" }, body: { fontFamily: "Manrope", fontSize: "14px", fontWeight: 400, lineHeight: 1.4 }, body-compact: { fontFamily: "Manrope", fontSize: "14px", fontWeight: 400, lineHeight: "20px" }, label: { fontFamily: "Manrope", fontSize: "14px", fontWeight: 500, lineHeight: "20px" }, label-snug: { fontFamily: "Manrope", fontSize: "14px", fontWeight: 500, lineHeight: 1.375 }, label-bold: { fontFamily: "Manrope", fontSize: "14px", fontWeight: 700, lineHeight: "20px" }, link: { fontFamily: "Manrope", fontSize: "14px", fontWeight: 700, lineHeight: "20px" }, caption: { fontFamily: "Manrope", fontSize: "12px", fontWeight: 400, lineHeight: "16px" }, tooltip: { fontFamily: "Manrope", fontSize: "12px", fontWeight: 800, lineHeight: 1.25 }, caption-medium: { fontFamily: "Manrope", fontSize: "12px", fontWeight: 500, lineHeight: "16px" }, input: { fontFamily: "Manrope", fontSize: "16px", fontWeight: 400, lineHeight: "24px" }, button-lg: { fontFamily: "Manrope", fontSize: "16px", fontWeight: 600, lineHeight: "24px" }, total: { fontFamily: "Manrope", fontSize: "16px", fontWeight: 700, lineHeight: "24px" }, body-lg: { fontFamily: "Manrope", fontSize: "16px", fontWeight: 400, lineHeight: "24px" }, label-lg: { fontFamily: "Manrope", fontSize: "16px", fontWeight: 500, lineHeight: "24px" }, badge: { fontFamily: "Manrope", fontSize: "10px", fontWeight: 700, lineHeight: 1 } }
rounded: { kbd: "4px", none: "0px", xs: "2px", arrow: "3px", full: "9999px" }
spacing: { "0": "0px", "1": "4px", "2": "8px", "3": "12px", "4": "16px", "5": "20px", "6": "24px", "7": "28px", "8": "32px", "9": "36px", "10": "40px", "11": "44px", "12": "48px", "13": "52px", "14": "56px", "15": "60px", "16": "64px", "17": "68px", "20": "80px", "22": "88px", "24": "96px", "28": "112px", "32": "128px", "36": "144px", "38": "152px", "40": "160px", "44": "176px", "48": "192px", "56": "224px", "60": "240px", "64": "256px", "70": "280px", "72": "288px", "80": "320px", "90": "360px", "96": "384px", "100": "400px", "112": "448px", "125": "500px", "140": "560px", "160": "640px", "200": "800px", "350": "1400px", "0.5": "2px", "1.5": "6px", "2.25": "9px", "2.5": "10px", "3.5": "14px", "3.75": "15px", "5.75": "23px", "12.5": "50px" }
components: { accordion: { textColor: "{colors.ink}", typography: "{typography.body-lg}" }, accordion-footer: { textColor: "{colors.ink}", typography: "{typography.heading}" }, alert-dialog: { backgroundColor: "{colors.surface}", textColor: "{colors.ink}", typography: "{typography.label-lg}", width: "{spacing.80}" }, alert-dialog-overlay: { backgroundColor: "{colors.scrim-dialog}" }, button: { backgroundColor: "{colors.ink}", textColor: "{colors.surface}", typography: "{typography.label}", height: "{spacing.13}" }, button-sm: { backgroundColor: "{colors.ink}", textColor: "{colors.surface}", typography: "{typography.label}", height: "{spacing.7}" }, button-outline: { backgroundColor: "{colors.field}", textColor: "{colors.ink}", typography: "{typography.label}", height: "{spacing.13}" }, button-outline-sm: { backgroundColor: "{colors.field}", textColor: "{colors.ink}", typography: "{typography.label}", height: "{spacing.7}" }, button-ghost: { textColor: "{colors.ink}", typography: "{typography.label}", height: "{spacing.13}" }, button-ghost-icon: { width: "{spacing.8}", height: "{spacing.8}" }, button-link: { textColor: "{colors.ink}", typography: "{typography.link}" }, checkbox: { backgroundColor: "{colors.field}", width: "{spacing.4}", height: "{spacing.4}" }, checkbox-true: { backgroundColor: "{colors.ink}", width: "{spacing.4}", height: "{spacing.4}" }, drawer: { backgroundColor: "{colors.surface}" }, drawer-left: { backgroundColor: "{colors.surface}" }, drawer-up: { backgroundColor: "{colors.surface}" }, drawer-overlay: { backgroundColor: "{colors.scrim}" }, drawer-title: { textColor: "{colors.ink}", typography: "{typography.heading}" }, dropdown-menu: { backgroundColor: "{colors.surface}", width: "{spacing.56}" }, dropdown-menu-item: { textColor: "{colors.ink}", typography: "{typography.total}", height: "{spacing.11}" }, dropdown-menu-item-true: { backgroundColor: "{colors.ink}", textColor: "{colors.surface}", typography: "{typography.total}", height: "{spacing.11}" }, field: {}, field-horizontal: {}, field-error: { textColor: "{colors.sale}", typography: "{typography.body-compact}" }, field-label: { textColor: "{colors.ink}", typography: "{typography.label-snug}" }, input: { backgroundColor: "{colors.field}", textColor: "{colors.ink}", typography: "{typography.input}", height: "{spacing.14}" }, input-true: { backgroundColor: "{colors.field}", textColor: "{colors.sale}", typography: "{typography.input}", height: "{spacing.14}" }, label: { textColor: "{colors.ink-muted}", typography: "{typography.label}" }, native-select: { backgroundColor: "{colors.field}", textColor: "{colors.ink}", typography: "{typography.body-compact}", height: "{spacing.8}" }, quantity-stepper-lg-boxed: { textColor: "{colors.ink}", typography: "{typography.body-compact}" }, quantity-stepper: { textColor: "{colors.ink}", typography: "{typography.body-compact}" }, radio-group: {}, radio-group-item: { backgroundColor: "{colors.field}", width: "{spacing.4}", height: "{spacing.4}" }, radio-group-item-true: { backgroundColor: "{colors.ink}", width: "{spacing.4}", height: "{spacing.4}" }, route-drawer: { backgroundColor: "{colors.surface}", textColor: "{colors.ink}", typography: "{typography.heading}" }, skeleton: { backgroundColor: "{colors.surface-muted}" }, toast: { backgroundColor: "{colors.surface}", textColor: "{colors.ink}", typography: "{typography.label}" }, tooltip: { backgroundColor: "{colors.ink}", textColor: "{colors.surface}", typography: "{typography.tooltip}", width: "{spacing.56}" } }
---

# Design System: Proteus storefront

The source of truth is `~/designs/proteus/Proteus.figcraft`. Its pages mirror the store's code folders: `Foundation` (token boards), `flows` (the navigation map), `app/<group>` (screen sets: `app/_main`, `app/_main/_authed`, `app/_auth`, `app/_checkout`), `components/ui` (primitives), `components/store` (store-wide blocks), `entities/<entity>`, `features/<feature>` and `brand` (wordmark, favicon, touch icons); the table and its rules are in `.claude/agents/designer.md`, "Structure mirrors the code". Everything generated from the file is exported through `@proteus/design`: `pnpm --filter @proteus/design run tokens:export` (the theme), `components:export` (each set's `*.variants.ts`) and `design-md` (this file's frontmatter), the last two landing with the scaffold and components-exporter slices; `icons:export`, `brand:export` and `flow:export` (with `check:flow`) arrive with the icons, brand and flows slices. Every exporter has a `--check` in the verify gate. Colour roles and their contrast are in `docs/design/colour.md`; drawing rules are in `docs/design/brand-rules.md`; which component comes from which set is in `apps/store/docs/components.md`.

This file describes the blueprint as it runs today, before any brand forks it. A brand that forks the blueprint replaces the design file's tokens and marks and rewrites the Overview; the structure and the rules stay.

## Overview

**Creative North Star: "The White Wall"**

The storefront is a gallery wall: the product photograph is the work, and the interface is the wall and the label beside it. Ink on white (or white on near-black in dark), square edges, hairlines, and one heavy uppercase voice for the few words that name a page. Colour belongs to the photographs; the interface keeps one hue for a single job and one red for sale and destruction.

Density follows a catalogue, not a dashboard: a 14 px body, generous gutters, 4:5 product crops that carry the page, and chrome that steps back. Hierarchy comes from weight and case before size: the display voice is ExtraBold and uppercase, everything else is sentence case at body size.

Mobile first. The phone layout is the base; wider viewports only add columns, rails and sticky panels. Light and dark are both real themes, switched by the shopper or following the system.

**Key Characteristics:**

- Near-black ink on white, a two-step surface (`surface`, `surface-subtle`), hairline `line` borders.
- One hue (`accent`) for count badges only; `sale` for sale prices and destructive actions.
- One typeface (Manrope Variable), two voices: uppercase ExtraBold display roles, sentence-case body.
- Square everywhere; a pill only for a label laid over something else.
- Flat: depth from surface steps, hairlines and an 80 % scrim behind drawers.

## Colors

Neutral ink and surfaces, one hue, one red, one green, plus a notice orange, a selection tint and the shadow colour. Values and ratios: `docs/design/colour.md`.

### Primary

- **Ink** (`ink`): text, icons, the default button fill, focus outlines. #0D1012 rather than black, because true black reads harsh against product photographs. Inverts in dark.
- **Surface** (`surface`): the page, panels, drawers, and the text on an ink button.

### Secondary

- **Surface Subtle** (`surface-subtle`): quiet wells and bands: account and address panels, the image box behind a product photograph, hover rows, the search control.
- **Line** (`line`): borders and dividers: the header's bottom edge, the footer's top, field and option outlines.

### Tertiary

- **Accent** (`accent`): the only hue. The bag's count badge, with `surface` text, never white.
- **Sale** (`sale`): sale prices, low-stock nudges, destructive actions (remove an address, delete a card). Lifts on dark rather than inverting.
- **Positive** (`positive`): positive states. Defined, not used by the store today.

### Neutral

- **Ink Muted** (`ink-muted`): secondary text: descriptions, footer links, meta lines, link hover.
- **Ink Subtle** (`ink-subtle`): tertiary text and placeholder glyphs: breadcrumb separators, empty-state icons, option values under a line item.
- **Ink Disabled** (`ink-disabled`): disabled marks: inactive gallery dots.
### Utility
- **Warning** (`warning`): the notice banners (the bag could not move to your account, the market switch failed). The same orange in both schemes, with `ink` text; the banners still use `bg-orange-300`, which the role reproduces.
- **Selection** (`selection`): the text-selection highlight, teal at 24 % in both schemes. The body still sets it with `selection:bg-[rgba(79,184,178,0.24)]`.
- **Shadow** (`shadow`): the colour of `shadow-panel`: `ink` at 20 %, so it inverts with the scheme.

### Named Rules

**The Photograph Carries the Colour Rule.** The interface is neutral so the product isn't competing with it. `accent` appears on the bag's count and nowhere else; a second use is a token decision for the owner, not a styling choice.

**The Red Means Money or Loss Rule.** `sale` marks a reduced price, scarcity, or an action that destroys something. Never decoration, never a generic error tint without words.

**The Roles Only Rule.** Every colour is a `color/*` role (`text-ink`, `bg-surface-subtle`). No hex, no palette step, no Tailwind default colour. The shadcn names the shared kit still reads (`--primary`, `--border`) are repointed at the roles in `apps/store/src/styles.css` until the store owns its primitives.

## Typography

**Display Font:** Manrope Variable (weight axis 200–800)
**Body Font:** Manrope Variable
**Label/Mono Font:** none

**Character:** one family, two voices. The display roles take Manrope to its ExtraBold end, uppercase and tight; body text stays at its regular weight in sentence case. The contrast between the two is the hierarchy.

### Hierarchy

- **Display** (`type-display`, ExtraBold 800, 32 → 48 px fluid between 375 and 1440 px, leading 0.9, −2 %, uppercase): the page's name: a category or search heading, "Hello, Name", the address book, an order confirmed, 404.
- **Title** (`type-title`, ExtraBold 800, 24 → 32 px fluid, leading 0.9, −2 %, uppercase): page titles below the display.
- **Heading** (`type-heading`, ExtraBold 800, 20 px, leading 0.94, −1 %, uppercase): panel and section headings, footer column titles, the wordmark.
- **Body** (`type-body`, Regular 400, 14 px, leading 1.4): the default, set on `body`; product titles, descriptions.
- **Body Compact** (`type-body-compact`, Regular 400, 14 / 20 px, `text-sm`): most UI text: lists, details, form help.
- **Label** (`type-label`, Medium 500, 14 / 20 px, `text-sm font-medium`): button labels, field labels, menu items.
- **Label Bold** (`type-label-bold`, Bold 700, 14 / 20 px, `text-sm font-bold`): link buttons, inline totals.
- **Caption** (`type-caption`, Regular 400, 12 / 16 px, `text-xs`): meta lines, option values, help and legal text.
- **Caption Medium** (`type-caption-medium`, Medium 500, 12 / 16 px, `text-xs font-medium`): small labels such as step names.
- **Input** (`type-input`, Regular 400, 16 / 24 px, `text-base`): field values on a phone, so iOS does not zoom; `md:text-sm` from `md`.
- **Button Large** (`type-button-lg`, SemiBold 600, 16 / 24 px): the tall auth buttons.
- **Total** (`type-total`, Bold 700, 16 / 24 px): order and bag totals, market menu items.
- **Badge** (`type-badge`, Bold 700, 10 px, leading 1): the bag's count badge.

The sizes behind them are the `text/*` scale (`text-2xs` 10, `text-xs` 12, `text-sm` 14, `text-base` 16, `text-lg` 18 px, each with Tailwind's leading), and the weights the `weight/*` scale (`font-normal` 400 to `font-extrabold` 800); both are generated, at Tailwind's default values, so the store's `text-sm font-medium` and `type-label` are the same thing. The store's classes still name the scale; the text styles are what a drawing applies.

### Named Rules

**The Two Voices Rule.** Uppercase belongs to the three display roles. Buttons, links and every sentence stay in title or sentence case, which is what keeps the two voices apart.

**The Fourteen Default Rule.** Body is 14 px and meta 12 px; nothing smaller. The bag's count badge at 10 px is the one place that breaks it today (recorded as a disagreement, not a precedent).

**The Role Not Size Rule.** A heading uses a `type-*` role, which carries size, weight, leading, tracking and case together. No hand-assembled `text-2xl font-extrabold uppercase`.

## Layout

A centred column up to 1400 px (`max-w-350`), with side gutters of 16 px on a phone, 24 px from `sm` and 32 px from `lg`. Spacing is a 4 px scale: `space/1` is Tailwind's `--spacing` step and every `space/<n>` in the design file is n steps, so `p-4` is `space/4` (16 px); the frontmatter lists the steps the store uses. Breakpoints are generated from `breakpoint/*` at Tailwind's defaults: `sm` 40rem, `md` 48rem, `lg` 64rem; mobile is the base. The design file draws frames at 390 (`Mobile`), 640 (`Sm`), 768 (`Md`) and 1440 px (`Desktop`); the fluid type sizes interpolate between Mobile (375) and Desktop, and the `Sm` and `Md` modes hold the interpolated value at their width.

- **Header:** sticky, 56 px tall on a phone and 80 px from `lg`, a `line` hairline under it. Three columns with the wordmark centred: menu and search icons on the left on a phone, the category rail from `lg`; search bar (from `lg`), account and bag on the right.
- **Product grid:** two columns on a phone, three from `sm`, four from `lg`; a 4 px column gutter and 24 px between rows. Each card is a 4:5 photograph on `surface-subtle`, then title, fit line and "From" price below, with no side inset on a phone.
- **Product page:** one column on a phone with the gallery full bleed; from `lg`, the gallery and a 410 px buy column that sticks under the header.
- **Footer:** an accordion of link columns on a phone, a two-column grid from `sm` and four from `lg`.
- **Drawers** (bag, search, menu, address forms) slide over the page from the side, their open state in the URL.
- Targets are at least 44 px for icon controls; full buttons are 52 px tall.
- A layout that changes across breakpoints changes by CSS. Server-rendered routes cannot read the viewport, so a structural switch is two stacked layouts or two DOM trees, never a JavaScript media query (the product gallery's `tabIndex` switch is the one allowed case).

## Elevation & Depth

Flat. Depth comes from the surface step (`surface` → `surface-subtle`), hairlines, and the scrim behind a drawer: black at 80 % with no blur, so a panel clearly sits above the page rather than at its depth.

### Named Rules

**The One Shadow Rule.** `shadow-panel` (0 −8 24 −8, the `shadow` role) lifts the bag's pinned footer off the content that scrolls up under it, cast upward and on `ink` at 20 % so it survives dark. Floating surfaces take `shadow-xl` (popovers, the market menu) and `shadow-lg` (toasts), black at 10 %, Tailwind's values. All three are `shadow/*` effect styles. Cards, buttons and panels have no shadow.

Motion is generated too: `duration/*` (100, 150, 200, 250, 300, 450 ms) and `ease/*`: `in-out` (Tailwind's default curve), `drawer` (cubic-bezier(0.32, 0.72, 0, 1), the drawer's slide and scrim, 450 ms), `drawer-content` (its content fade, 300 ms) and `toast`. Links and buttons fade colour and opacity over 150 ms.

**The Scrim Separates Rule.** An overlay over product photography gets the 80 % scrim. A weaker scrim lets the page argue with the panel.

## Shapes

Square. The radius is 0 everywhere (`radius/none`; `--radius: 0rem` in the store squares every shadcn primitive at once). Two small radii exist only on tooltip and popover arrows (`radius/xs` 2 px, `radius/arrow` 3 px). The pill (`rounded-full`, `radius/full`) is reserved for a label laid on top of something: the sold-out badge on a photograph, the bag and line-item count badges, the signed-in avatar, gallery dots, and the theme toggle. Everything that sits in the grid is square.

The wordmark is the store name set in `type-heading`, not a drawn mark. Favicon and touch icons are placeholder images today and come from the `brand` page once the brand slice draws them.

## Components

Components are drawn in `Proteus.figcraft` and exported to `cva()` variants (`apps/store/docs/components.md`, "From FigCraft to code"). No primitive is drawn yet; this section lists each one as its slice lands.

## Do's and Don'ts

### Do:

- **Do** keep colour in the photographs: ink, surfaces and hairlines for the interface.
- **Do** use `accent` only for the bag's count, and `sale` only for sale, scarcity and destruction, with words.
- **Do** name a page with a `type-*` role and keep every other line in sentence case at body size.
- **Do** keep everything square and give a pill only to a label laid over something.
- **Do** build the phone layout first and only add at `sm`, `md` and `lg`.
- **Do** keep icon targets at 44 px or more and text at 12 px or more.
- **Do** use real catalogue content: seed products, real prices, the `en` catalog's copy.

### Don't:

- **Don't** add a second hue, a gradient, or a brand-tinted surface.
- **Don't** round cards, buttons, fields or panels.
- **Don't** put shadows on cards, buttons or panels; depth is the surface step and the scrim.
- **Don't** set buttons, links or sentences in uppercase.
- **Don't** switch layout with a JavaScript media query, or start desktop-first and undo it on a phone.
- **Don't** use hex values, palette steps or Tailwind's default colours.
- **Don't** name or copy a reference brand; take the job a layout does, not its look.
