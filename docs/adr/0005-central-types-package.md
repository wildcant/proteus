# 5. Central Types Package

**Status:** Accepted — superseded in part by [ADR-0028](0028-barrels-only-at-a-published-boundary.md). The contracts still live in `core/types/<domain>/`; the `index.ts` barrels this ADR describes are gone, and consumers import the concrete file.

## Context

Public type contracts (DTOs, service interfaces, filter types) need to be importable by API routes, workflows, and other modules without creating circular dependencies.

Options:
- **Module re-exports:** Each module exports its own types from a `types/` folder. Consumers import from `modules/order/types`. Risk: circular imports when Module A's service interface references Module B's DTO.
- **Central package:** All public contracts live in `core/types/` with per-domain subfolders. Modules implement these interfaces but don't own them.

## Decision

Public type contracts live in `core/types/<domain>/` with three files per domain:
- `common.ts` — Read DTOs and filterable props
- `mutations.ts` — Create/Update DTOs
- `service.ts` — Module service interface

Re-exported from `core/types/index.ts`.

Modules' internal `types/` folders (optional) are for internal-only types that differ from the public contract.

```
core/types/
  common.ts          ← shared utilities (OperatorMap, BaseFilterable, FindConfig)
  context.ts         ← Context type
  customer/
    common.ts
    mutations.ts
    service.ts
    index.ts
  order/
    ...
  index.ts           ← barrel re-export
```

## Consequences

- Zero circular dependency risk — types flow one direction (core → modules implement them)
- API routes and workflows import from one stable path
- Adding a new module's types doesn't affect existing modules
- Module implementations must stay in sync with the central interface (TypeScript enforces this)
- Slightly more ceremony when creating a new module (must create types in two places)
