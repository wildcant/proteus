# Store app

Read the relevant file before working in a subdirectory:

- **Components** (`src/components/`, `entities/*/ui/`, `features/*/components/`): `standards/rules/frontend/components/.context.md`
- **Feature and entity API hooks** (`features/*/api/`, `entities/*/api/`): `standards/rules/frontend/features/api/.context.md`
- **Feature hooks** (`features/*/hooks/`): `standards/rules/frontend/features/hooks/.context.md`
- **Look and design contract**: `DESIGN.md` (repo root) and `apps/store/docs/components.md` — the FigCraft file is the source of truth; `*.variants.ts` change only through `components:export`
- **Layers** (`entities/`, a feature needing another feature's code): `docs/adr/0034-store-entities-layer-replaces-the-feature-graph.md`
- **Links and navigation** (a `LinkTarget` prop, `flowLinks`, `src/navigation/`): `apps/store/docs/components.md`, "Navigation"
