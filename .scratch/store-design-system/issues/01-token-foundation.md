# 01 — Token foundation

Port the reference system's colour, type and radius into the store's token layer, so later pages
inherit it instead of restyling themselves.

## Scope

`apps/store/src/styles.css` only. Do not touch `packages/ui` — it is shared with `apps/admin`.

## Work

- Register the ink/surface/line palette in `@theme` as `var()` indirections, so values can be
  themed on `:root`. Follow the existing `--color-foreground-muted` precedent.
- Add `type-display`, `type-title`, `type-heading` as `@utility` rules. Do not name them `text-*`
  (tailwind-merge would treat them as colours and drop them).
- Set `--radius: 0rem` on `:root`.
- Repoint the shadcn base (`--primary`, `--border`, `--input`, `--ring`, `--destructive`,
  `--muted-foreground`) at the new palette.
- Keep `--foreground`, `--foreground-muted`, `--bg-subtle` and repoint them, so existing usages
  keep resolving without edits.
- `body { font-size: 0.875rem; line-height: 1.4 }` — 14px body, the reference's density.
- Mirror every token in both dark blocks (`[data-theme="dark"]` and `prefers-color-scheme`).

## Done when

`npm run verify` passes and the storefront renders square-cornered with `#0d1012` ink, with no
page-level edits anywhere.
