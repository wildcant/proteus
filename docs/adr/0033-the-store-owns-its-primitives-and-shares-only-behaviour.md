# 33. The Store Owns Its Primitives, and Shares Only Behaviour Through `@proteus/ui-core`

**Status:** Accepted

## Context

The storefront's primitives came from `@proteus/ui`, a shadcn-based kit the admin also builds on.
The store's look was layered on top of it: `components/button.tsx` wrapped the shared button with
its own sizes, `styles.css` zeroed `--radius` and repointed shadcn's `--primary`, `--border`,
`--accent-foreground` and `--popover` at the store's colour roles, and imported the kit's generated
stylesheet for the drawer's keyframes. Every one of those lines exists because the store's look
and the admin's were coupled through one kit: a change to the shared primitive restyled both apps,
and a storefront judgement (the 80 % drawer scrim, square corners) had to be made as an override so
the admin kept its own.

The storefront's look is now drawn in `Proteus.figcraft` and exported as `cva()` variants
(`DESIGN.md`). A generated variants file has to sit beside the component it styles, and the store
cannot generate into a package the admin also renders.

## Decision

**The store owns its primitives in `apps/store/src/components/ui/<name>/`, built directly on
`@base-ui/react`, styled by the variants exported from the design file. What both apps share is
behaviour only, in a new non-visual package, `@proteus/ui-core`.**

- `@proteus/ui-core` holds `cn()`, the shared hooks except `use-mobile`, the toast manager and
  `toast()`, `useRouteModal`, the route-modal provider and context, the router type augmentation,
  and `createPromptHook`, a factory that takes each app's own prompt renderer. It depends on
  `@base-ui/react` and renders nothing styled. Its entry is a barrel, allowed by ADR-0028 because
  it is a published package boundary.
- `@proteus/ui` keeps every visual component, `use-mobile` and the admin-only route-modal pieces. It
  imports what moved and re-exports it from its existing entry, binding the prompt factory to its own
  alert dialog, so not one admin import changes.
- Each piece lives in exactly one of the two packages; nothing is copied between them.
- The store renders its own `Toaster` over the shared manager, its own route drawer over the shared
  `useRouteModal`, and its own alert dialog for the prompt. Each primitive keeps the same base-ui
  part, props and ARIA roles it had, so focus, keyboard and portal behaviour do not change.
- Once the last primitive moves, the store drops `@proteus/ui`, the kit's stylesheet import, the
  `@source` line and the shadcn variable repoints, and a structure rule forbids the store from
  importing `@proteus/ui`. A matching rule forbids the admin from importing `@proteus/design`.

## Considered Options

**Keep `@proteus/ui` and theme it per app.** Rejected: the store would still style a component it
doesn't own, the generated variants would have nowhere to live beside their component, and every
storefront decision would remain an override of the admin's default.

**Copy the kit into the store.** Rejected: the non-visual pieces (toast state, route modals, the
prompt mechanism) would exist twice and drift; they are the part that is genuinely the same in both
apps.

**Move the admin too.** Out of scope: the admin has no design file, and its diff stays empty.

## Consequences

- The admin is untouched: `@proteus/ui`'s entry still exports everything it did, now partly by
  re-export.
- The store's primitives move one at a time; until the last one moves, the store depends on both
  packages, and `lucide-react` stays until the icons slice generates the store's own glyphs.
- A primitive fix the admin also wants is made twice, once per app. That is the price of the two
  looks being independent, and it applies only to the visual layer.
