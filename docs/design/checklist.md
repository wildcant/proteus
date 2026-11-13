# Design checklist

Run before handing a FigCraft frame or component back to the owner. Structure first (from `get_node`), then the screenshot. One inspection round, one fix batch, at most one confirming round.

## Structure (read from `get_node`)

- [ ] Every fill and stroke has a `boundVariables` entry pointing at a `Theme` role (`color/*`). No raw hex, no `palette/*`.
- [ ] Every text layer uses a `type/*` text style. No local size, case or tracking.
- [ ] Sizes on the 4 px scale; radius 0 except a pill on an overlaid label. Values the design file has no token for are listed in the report as gaps, not invented.
- [ ] Containers use auto layout. Absolute layers only sit outside the flow on purpose (a badge over a photograph).
- [ ] Sizing is right: text that wraps has a fixed or fill width; nothing hugs or fills by accident; nothing is clipped.
- [ ] Repeated elements are instances of component sets (`components/ui`, `components/store`, `entities/<entity>`, or the feature's page), with text set through component properties. No detached instances, and no set that no screen uses.
- [ ] Only the variants the code uses are drawn. A `viewport` property (`mobile`, `sm`, `md`, `lg`) only where the set changes at that breakpoint.
- [ ] Every layer has a meaningful name. Sets and variants use the code names; layers use the `cva` export names.
- [ ] Components: one-line description on the set with its code path; every property wired to a layer.
- [ ] No leftover placeholder text, hidden scratch layers or empty frames.
- [ ] Each screen state is a variant (`state=<state>`, `viewport=<viewport>`) of its screen set on the `app/<group>` page, each frame on the matching `Viewport` mode. Component sets sit on the page that matches their code folder. Nothing new on `Foundation`; nothing loose at a page's top level.
- [ ] The `flows` map shows the new screen or state and every way in and out of it as an arrow labelled with an event (including `BACK` and `CLOSE`), with conditions written on conditional arrows. Header-level transitions sit on `Root`.

## Brand (against `brand-rules.md`)

- [ ] `color/accent` only on the bag's count badge, with `color/surface` text.
- [ ] `color/sale` only on sale prices, scarcity and destructive actions, with words.
- [ ] Uppercase only in the `type/*` display roles; buttons and links in title case.
- [ ] Square everywhere; a pill only for an overlaid label.
- [ ] No shadow except the bag's pinned footer; drawers over the 80 % scrim.
- [ ] No pattern from the banned table. If one was needed, the reason is in the report.

## Use (against `PRODUCT.md`)

- [ ] Drawn first at 390 px (`mobile`); larger viewports only add.
- [ ] Icon targets at least 44 × 44; full buttons 52 px tall.
- [ ] Text 12 px or larger.
- [ ] Contrast: text on `surface` and `surface-subtle` uses a role that passes 4.5:1 in both themes (`colour.md`). The known failures (`ink-muted` in light, `ink-subtle`) are drawn as the store runs them and noted, not fixed.
- [ ] State is never colour alone: selected, sold out and disabled each have a shape or text cue.
- [ ] Copy from the `en` catalog; products, prices and images from the seed data or plain placeholders.
- [ ] Spanish fits: labels and buttons have room for text about 30 % longer.
- [ ] The states the screen has in code are drawn or listed as missing: loading (skeleton), empty, error, guest and signed in, validation, drawer open.

## Look (from `screenshot`)

- [ ] Screenshot taken on the page, not as a lone layer.
- [ ] Compared with the running store at the same width and theme; differences are deliberate and recorded in the plan file.
- [ ] Checked in dark by switching the frame's `Theme` mode; nothing drawn twice.
- [ ] Nothing overlaps, clips or floats off its grid.

## Hand over

- [ ] Backup taken before the first change; file saved after every chunk and once more at the end.
- [ ] "For the coding session" list in the report: exports to run (`components:export <Name>`, `tokens:export`, `icons:export`, `brand:export`, `flow:export`, then `design-md`) and the code to change. The designer runs none of them.
- [ ] `DESIGN.md` (Components) and `apps/store/docs/components.md` updated; the plan file `~/designs/proteus/plan-ui-source-of-truth.md` updated.
- [ ] Report: frames and ids, screenshots, decisions with reasons, unmet checks, proposed tokens.
