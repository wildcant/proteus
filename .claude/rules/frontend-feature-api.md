---
paths:
  - "apps/{admin,store}/src/features/*/api/**"
---

# Feature API hooks

`features/{name}/api/` is the layer between a feature and the generated API client — one file per
resource, holding both its reads and its writes. Before adding or changing a hook there, read
`standards/rules/frontend/features/api/__docs__/README.md` and the document it routes you to.
