---
paths:
  - "apps/{admin,store}/src/features/*/hooks/**"
---

# Feature hooks

`features/{name}/hooks/` holds the hooks a feature owns that are not its API layer — the ones that
turn user input into a write, and the ones that assemble everything a page reads. Before adding or
changing one, read `standards/rules/frontend/features/hooks/__docs__/README.md` and the document it
routes you to.
