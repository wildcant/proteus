# Colour

The colour system in `~/designs/proteus/Proteus.figcraft`, the design source of truth. It has a light and a dark theme. How colour is used on screens is in `DESIGN.md` and `brand-rules.md`; this file is the token reference. The values below are read from `packages/design/tokens/tokens.gen.css`; when they change, re-measure the contrast table.

## Structure

- **Primitives:** collection `Primitives`, mode `Value`. Ramps `palette/neutral/*`, `palette/blue/*`, `palette/red/*`, `palette/green/*`, `palette/orange/*`, plus `font/sans`. No Tailwind default colours.
- **Roles:** collection `Theme`, modes `Light` and `Dark`, flat kebab-case `color/*` names so each becomes a class (`text-ink-muted`, `bg-surface-subtle`). A role aliases a primitive in each mode where an opaque ramp step fits; a translucent role (`selection`, `shadow`, the rings, scrims and washes) holds its colour with its alpha.
- Layers bind roles only, never `palette/*`. A new role is proposed to the owner first (name, primitive in each mode, why), then added in FigCraft and followed by `tokens:export`.
- The generated CSS puts `Light` on `:root` and `Dark` on `:root[data-theme="dark"]` and under `prefers-color-scheme: dark` unless the shopper chose light.

## Primitives (`palette/*`)

| Ramp | Steps used | Job |
|---|---|---|
| `neutral/*` | 0 #FFFFFF · 100 #F4F5F6 · 200 #DEE0E3 · 300 #BEC2C6 · 400 #9FA3A8 · 500 #767A7F · 600 #575B60 · 800 #2E3238 · 900 #1B1D22 · 950 #0D1012 | Ink, surfaces, lines |
| `blue/*` | 300 #7AA9FF · 700 #004EBA | The one hue |
| `red/*` | 300 #FF8FA5 · 600 #DC0428 | Sale and destruction |
| `green/*` | 400 #00E890 · 600 #009966 | Positive states |
| `orange/*` | 300 #FFB86A | Notice banners |

## Roles (`color/*`)

| Role | Light | Dark | Use |
|---|---|---|---|
| `ink` | neutral/950 #0D1012 | neutral/100 #F4F5F6 | Text, icons, the default button fill, focus outlines. Not pure black: true black reads harsh against product photos |
| `ink-muted` | neutral/500 #767A7F | neutral/400 #9FA3A8 | Secondary text |
| `ink-subtle` | neutral/400 #9FA3A8 | neutral/500 #767A7F | Tertiary text, placeholder glyphs |
| `ink-disabled` | neutral/300 #BEC2C6 | neutral/600 #575B60 | Disabled marks |
| `surface` | neutral/0 #FFFFFF | neutral/950 #0D1012 | Page and panels; text on `ink` and on `accent` |
| `surface-subtle` | neutral/100 #F4F5F6 | neutral/900 #1B1D22 | Quiet wells and bands, the photograph's box |
| `line` | neutral/200 #DEE0E3 | neutral/800 #2E3238 | Borders and dividers |
| `accent` | blue/700 #004EBA | blue/300 #7AA9FF | The only hue: count badges, with `surface` text, never white |
| `sale` | red/600 #DC0428 | red/300 #FF8FA5 | Sale prices and destructive actions; lifts on dark rather than inverting |
| `positive` | green/600 #009966 | green/400 #00E890 | Positive states; unused in the store today |
| `warning` | orange/300 #FFB86A | orange/300 #FFB86A | Notice banners (cart transfer, market switch failed), with `ink` text |
| `selection` | #4FB8B2 at 24 % | #4FB8B2 at 24 % | Text-selection highlight |
| `shadow` | #0D1012 at 20 % | #F4F5F6 at 20 % | The colour of `shadow-panel`: `ink` at 20 % |
| `field` | #DEE0E3 at 0 % | #2E3238 at 30 % | Form control fill (input, checkbox, radio, outline button): a well on the dark surface |
| `field-disabled` | #DEE0E3 at 50 % | #2E3238 at 80 % | Disabled field fill |
| `field-invalid` | red/600 #DC0428 | #FF8FA5 at 50 % | An invalid field's border |
| `outline` | neutral/950 #0D1012 | neutral/800 #2E3238 | Outline button border |
| `outline-hover` | #0D1012 at 5 % | #2E3238 at 50 % | Outline button hover |
| `ghost-hover` | #F5F5F5 | #262626 at 50 % | Ghost button hover |
| `surface-muted` | #F5F5F5 | #262626 | Skeletons; the prompt footer at 50 % |
| `control` | neutral/0 #FFFFFF | #2E3238 at 30 % | The prompt's cancel button fill |
| `choice-checked` | #0D1012 at 0 % | #F4F5F6 at 10 % | A checked choice's label tint (checkout's saved address) |
| `focus-ring` | #0D1012 at 50 % | #F4F5F6 at 50 % | The 3 px keyboard focus ring |
| `popup-ring` | #0D1012 at 10 % | #F4F5F6 at 10 % | The hairline ring around popups (the alert dialog) |
| `sale-wash` | #DC0428 at 10 % | #FF8FA5 at 20 % | Destructive button fill (the prompt's confirm) |
| `sale-ring` | #DC0428 at 20 % | #FF8FA5 at 40 % | The destructive button's focus ring |
| `scrim` | black at 80 % | black at 80 % | The drawer scrim |
| `scrim-dialog` | black at 10 % | black at 10 % | The prompt scrim, behind a 4 px blur |

`warning` is the sRGB value of Tailwind's `orange-300` (`oklch(83.7% 0.128 66.29)`), which lies outside sRGB; the design file is sRGB, so the role holds #FFB86A and the banners use `bg-warning`.

## Contrast

WCAG 2 ratios, computed from the role values above. AA needs 4.5:1 for body text and 3:1 for large text (24 px, or 18.7 px bold) and for a control's edge or a meaningful glyph.

### Light

| Foreground | on `surface` | on `surface-subtle` |
|---|---|---|
| `ink` | 19.1 | 17.5 |
| `ink-muted` | 4.3 | 4.0 |
| `ink-subtle` | 2.5 | 2.3 |
| `ink-disabled` | 1.8 | 1.6 |
| `accent` | 7.5 | 6.9 |
| `sale` | 5.1 | 4.7 |
| `positive` | 3.7 | 3.4 |
| `line` | 1.3 | 1.2 |

### Dark

| Foreground | on `surface` | on `surface-subtle` |
|---|---|---|
| `ink` | 17.5 | 15.5 |
| `ink-muted` | 7.5 | 6.7 |
| `ink-subtle` | 4.4 | 3.9 |
| `ink-disabled` | 2.8 | 2.5 |
| `accent` | 8.1 | 7.2 |
| `sale` | 8.8 | 7.8 |
| `positive` | 11.8 | 10.4 |
| `line` | 1.5 | 1.3 |

### Pairs

- `surface` on `ink` (the default button): 19.1 light, 17.5 dark.
- `surface` on `accent` (the count badge): 7.5 light, 8.1 dark.
- `surface-subtle` against `surface`: 1.1 in both themes. The step separates bands; it is never the only edge of a control.

### What passes

- `ink`, `accent` and `sale` pass 4.5:1 on both surfaces in both themes.
- `line` is decoration only (1.2–1.5): a field's or option's edge needs a second cue (the label, a selected outline in `ink`).

### Gaps for the owner

Measured, not fixed. Each is a token decision (`DESIGN.md`, Do's and Don'ts; no role changes without approval):

- **`ink-muted` in light is 4.3 on `surface` and 4.0 on `surface-subtle`**, under 4.5:1, and it is the store's secondary text at 14 px (about 100 uses). Dark passes (7.5 / 6.7).
- **`ink-subtle` is 2.5 / 2.3 in light and 4.4 / 3.9 in dark.** It passes 3:1 only for glyphs in dark. It is used as text in a few places (the PDP fit line, option values under a line item, upcoming steps on the order track), which fails in both themes.
- **`ink` on `warning`: 11.2 in light, 1.6 in dark.** The banner keeps `ink` text on the same orange in both schemes, so in dark the text is near-white on orange and fails.
- **`positive` in light is 3.7 / 3.4.** Fine for an icon or large text; not for body text. Unused today.
