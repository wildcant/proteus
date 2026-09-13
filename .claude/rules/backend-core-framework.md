---
paths:
  - "apps/backend/src/core/**"
  - "apps/backend/src/framework/**"
---

# `core/` and `framework/`

`src/core/` is what is *known* — the vocabulary and the ports; `src/framework/` is what *runs* — the
containers, the adapters, the transports. Which side a file belongs on, and what already sits there,
is in `src/core/README.md` and `src/framework/README.md`; ADR-0026 records the split and ADR-0027 the
layer graph that enforces it.
