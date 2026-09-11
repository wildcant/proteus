---
paths:
  - "apps/*/tests/**"
  - "apps/backend/src/**/__tests__/**"
  - "packages/testing/**"
---

# Test data

`apps/backend/tests/factories/db/` holds this repo's test-data factories, and both test levels reach
them through the `factories` fixture in `packages/testing/`. Before writing setup by hand, read
`.claude/skills/e2e-test/SKILL.md` for a Playwright spec, or `.claude/skills/backend-test/SKILL.md`
for a backend integration test.
