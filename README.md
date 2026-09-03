# Proteus

An architectural prototype exploring **Ports & Adapters** (Hexagonal Architecture) combined with **Domain-Driven Design** concepts. The goal is to define a modular, loosely-coupled system where any piece — ORM, HTTP framework, payment gateway, runtime platform — can be swapped without touching business logic.

The backend follows a strict module isolation pattern with Awilix DI, and the store follows [Bulletproof React](https://github.com/alan2207/bulletproof-react) conventions for unidirectional, feature-based organization.

---

## Table of Contents

- [Why this exists](#why-this-exists)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Architecture](#architecture)
  - [Backend — Ports & Adapters](#backend--ports--adapters)
  - [Store — Bulletproof React](#store--bulletproof-react)
- [Key design decisions](#key-design-decisions)
- [Getting started](#getting-started)
- [Documentation](#documentation)

---

## Why this exists

Most frameworks couple your business logic to their internals. Adding a feature means touching framework code. Swapping a database means rewriting services. Deploying to a different platform means restructuring the app.

This prototype proves you don't have to accept that. It demonstrates:

- **Swappable ORM adapters** — change one import to go from Drizzle to Prisma
- **Swappable HTTP frameworks** — same route handlers work with a zero-dep router, Express, or Hono
- **Swappable platform runners** — Node.js, Cloudflare Workers, Bun, Deno, Vercel, Lambda — same code
- **Swappable payment providers** — Stripe, system (mark-as-paid), or your own — same payment module
- **Backend as a library** — the store can call services directly via the DI container, skipping HTTP entirely
- **True module independence** — modules don't import each other; cross-module concerns live in dedicated link modules and workflows

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| **Language** | TypeScript (strict) |
| **Backend runtime** | Node.js, Cloudflare Workers (workerd) |
| **DI container** | Awilix (FP-style factories) |
| **Database** | PostgreSQL |
| **ORM** | Drizzle ORM |
| **Validation** | Zod |
| **API docs** | OpenAPI 3.1 + Swagger UI (auto-generated from Zod schemas) |
| **Frontend framework** | React 19 + TanStack Router + TanStack Start |
| **API client generation** | Orval (from OpenAPI spec) |
| **Styling** | Tailwind CSS v4 |
| **Testing** | Vitest + Testing Library |
| **Linting/formatting** | Biome |
| **Dependency analysis** | dependency-cruiser (enforced rules) |

---

## Project structure

```
proteus/
├── apps/
│   ├── backend/                        # API server (Ports & Adapters)
│   │   └── src/
│   │       ├── api/                    # Route handlers (file-based routing)
│   │       │   ├── admin/              # Admin API (customers, users, payments, ...)
│   │       │   ├── store/              # Store API (carts, products, payment-collections, ...)
│   │       │   └── hooks/              # Webhook handlers (payment providers)
│   │       ├── core/                   # Shared infrastructure
│   │       │   ├── bootstrap/          # Module bootstrapping
│   │       │   ├── db/                 # DbProvider port + Node/Workers adapters
│   │       │   ├── errors/             # AppError, error handler, DB error mapper
│   │       │   ├── logger/             # Winston (Node), Console (Workers), Noop (tests)
│   │       │   ├── middleware/         # Validation middleware + OpenAPI registration
│   │       │   ├── openapi/            # OpenAPI registry + spec generation
│   │       │   ├── types/              # Public type contracts (DTOs, service interfaces)
│   │       │   ├── utils/              # BaseRepository, withTransaction, Module()
│   │       │   └── workflows/          # Workflow engine port + adapters
│   │       ├── modules/                # Domain modules (isolated)
│   │       │   ├── customer/
│   │       │   ├── user/
│   │       │   ├── cart/
│   │       │   ├── product/
│   │       │   ├── inventory/
│   │       │   └── payment/
│   │       ├── link-modules/           # Cross-module relationships
│   │       ├── providers/              # External service adapters (Stripe, etc.)
│   │       ├── workflows/              # Cross-module orchestration (saga/compensation)
│   │       ├── server/                 # Zero-dep router + platform adapters
│   │       ├── container.ts            # Composition root
│   │       └── index.ts                # Entry point (standalone API)
│   │
│   └── store/                          # Storefront SPA (Bulletproof React)
│       └── src/
│           ├── api/                    # Generated API client (Orval)
│           ├── features/               # Feature modules (co-located logic)
│           │   └── customers/
│           ├── components/             # Shared UI components
│           ├── lib/                    # App-wide utilities (query client, etc.)
│           ├── routes/                 # TanStack Router pages
│           └── server/                 # TanStack Start server functions
│
├── packages/
│   └── http-schemas/                   # Shared Zod schemas (used by both apps)
│
└── docs/
    ├── adr/                            # Architecture Decision Records
    ├── research/                       # Deep-dive research notes
    ├── adding-a-module.md              # Step-by-step guide
    ├── error-handling.md               # Error handling patterns
    └── middleware-and-openapi.md        # Middleware + OpenAPI guide
```

---

## Architecture

### Backend — Ports & Adapters

Every domain module follows the same layered structure. Business logic depends only on interfaces (ports), never on frameworks or ORMs. Concrete implementations (adapters) are injected at boot time via Awilix.

```
                  ┌──────────────────────────────────────────────┐
  HTTP Request ──>│  Route Handler (driving adapter)             │
                  │         │                                    │
                  │         v                                    │
                  │  ModuleService (business logic)              │
                  │         │                                    │
                  │         v                                    │
                  │  Repository interface (driven port)          │
                  └─────────│────────────────────────────────────┘
                            v
                  ┌───────────────────────┐
                  │  Drizzle / Prisma      │  <── driven adapter (swap by changing one import)
                  │  (implements repo)     │
                  └───────────────────────┘
```

**Module isolation**: Each module gets its own private Awilix container. Only the public service is exposed to the shared container. Modules cannot access each other's repositories or internals.

```
shared container
  ├── "customer"   → CustomerModuleService (public API)
  ├── "cart"       → CartModuleService (public API)
  ├── "payment"    → PaymentModuleService (public API)
  └── ...

customer local container (private)
  ├── db               → drizzle instance
  ├── withTransaction  → transaction helper
  └── customerRepository → CustomerRepository
```

**Cross-module relationships** don't live inside modules. They live in `link-modules/` — a flat structure of join tables and Drizzle `relations()` definitions that modules never import. A typed `LinkService` provides repository access through `linkService.repo("cartProduct")`.

**Workflows** handle cross-module orchestration. They chain `ctx.step()` calls, where each step resolves its own services from the container. Workflows are pure composition — steps are the unit of work. Failed workflows can compensate (undo completed steps).

**Two entry points** serve the same business logic without code changes:

```
Standalone API:    Request → fetch router → container → service → DB
TanStack Start:    createServerFn → container → service → DB (no HTTP round-trip)
```

#### Backend dependency graph

This graph is generated by dependency-cruiser with enforced rules — modules cannot import each other, and dependency direction is strictly enforced.

![Backend dependency graph](apps/backend/deps-analyzer/dependency-graph.svg)

### Store — Bulletproof React

The store follows [Bulletproof React](https://github.com/alan2207/bulletproof-react) conventions: feature-based organization with unidirectional dependencies. Shared code (components, hooks, lib, types, utils) flows into features, features flow into the application shell. Features never import from each other.

![Store unidirectional architecture](apps/store/deps-analyzer/unidirectional-codebase.png)

- **`api/`** — Generated TypeScript client from the backend's OpenAPI spec (via Orval). Type-safe API calls with zero manual typing.
- **`features/`** — Self-contained feature modules. Each feature co-locates its API layer, components, hooks, and types.
- **`components/`** — Shared UI components used across features.
- **`lib/`** — App-wide utilities (query client, query key factory, etc.).
- **`routes/`** — TanStack Router file-based pages. Thin — they compose feature components.

---

## Key design decisions

Each major decision is documented as an ADR in [`docs/adr/`](docs/adr/). Here's the quick-reference:

| # | Decision | Why it matters |
|---|----------|---------------|
| [0001](docs/adr/0001-per-module-container-isolation.md) | Per-module container isolation | Modules can't accidentally depend on each other's internals |
| [0002](docs/adr/0002-no-cross-module-transactions.md) | No cross-module transactions | Each module owns its transactional boundary; enables future service extraction |
| [0003](docs/adr/0003-sql-level-prefixed-ids.md) | SQL-level prefixed IDs | `cus_550e8400...` generated by Postgres — single source of truth, no app-level utility |
| [0004](docs/adr/0004-link-modules-for-cross-module-joins.md) | Link modules for cross-module joins | Cross-module relationships without cross-module imports |
| [0005](docs/adr/0005-central-types-package.md) | Central types package | Public contracts in `core/types/` prevent circular imports |
| [0006](docs/adr/0006-soft-delete-by-default.md) | Soft-delete by default | Every table has `deleted_at`; BaseRepository auto-filters |
| [0007](docs/adr/0007-zero-dependency-web-standard-router.md) | Zero-dep Web Standard router | `fetch(Request) → Response` — runs on any platform, no framework lock-in |
| [0008](docs/adr/0008-operator-based-filter-system.md) | Operator-based filter system | `$eq/$in/$like/$and/$or` filters translated to SQL in BaseRepository |
| [0009](docs/adr/0009-workflow-engine-and-step-pattern.md) | Workflow engine + step pattern | Cross-module orchestration with compensation — standard async/await, no DAG infrastructure |
| [0010](docs/adr/0010-payment-provider-driven-port.md) | Payment provider as driven port | `IPaymentProvider` interface + `AbstractPaymentProvider` base class — add providers without touching module logic |
| [0011](docs/adr/0011-module-loaders-and-module-provider.md) | Module loaders + ModuleProvider | Runtime adapter registration at boot time — loaders run after DI setup, before the service is exposed |
| [0012](docs/adr/0012-single-auth-identity-per-email.md) | One auth identity per email | An address is one person; roles are app metadata on that identity, not separate accounts |
| [0013](docs/adr/0013-selective-ssr.md) | Selective SSR for the store | Only the routes that need crawlable HTML pay for a server render |
| [0014](docs/adr/0014-dual-file-upload-strategy.md) | Dual file upload strategy | Multipart for small files, presigned URLs for large ones — one API, two transports |
| [0015](docs/adr/0015-server-computed-option-projections.md) | Server-computed option projections | The variant matrix is derived once on the server, not reassembled by every client |
| [0016](docs/adr/0016-derived-soft-delete-cascade.md) | Derived soft-delete cascade | The cascade is read off the schema graph, so a new table cannot be forgotten |
| [0017](docs/adr/0017-cart-state-is-a-timestamp.md) | Cart state is a timestamp | `completedAt` is the whole state machine — no status column to disagree with it |
| [0018](docs/adr/0018-layered-product-options.md) | Layered product options | Global option definitions, per-product scoping, per-variant values |
| [0019](docs/adr/0019-modals-are-url-state.md) | Modals are URL state | Open/closed lives in search params, so back, refresh and a shared link all behave |
| [0020](docs/adr/0020-store-feature-graph-is-acyclic.md) | Store feature graph is acyclic | Declared feature DAG enforced by dependency-cruiser, so a latent cycle cannot accumulate |
| [0021](docs/adr/0021-temporal-adapter-replays-to-the-next-step.md) | Temporal adapter replays to the next step | Durable execution with zero changes to 26 workflows — the handler is re-entered per step, so purity between steps is enforced |
| [0022](docs/adr/0022-durable-execution-is-a-runtime-split.md) | Durable execution is a runtime split | Cloudflare cannot load Temporal's native Worker, so it has no durability — accepted, documented, and covered by a parity suite |

---

## Getting started

### Prerequisites

- Node.js 20+
- Docker (PostgreSQL, Temporal, and the Temporal UI)

### Setup

```bash
# Install dependencies
npm install

# Start local Postgres (the dev task below does this for you; needed here for the migrations)
npm run --workspace=backend db:start

# Run database migrations
npm run --workspace=backend db:migrate:dev

# (Optional) Seed dev data
npm run --workspace=backend db:seed:dev
```

### Running

In VS Code, press **`Cmd+Shift+B`**. That is the whole dev session.

It runs the `dev` task from `.vscode/tasks.json`, which brings up Postgres, Temporal and the Temporal
UI in Docker, then opens four terminal panes side by side — API, Worker, store, admin — and opens the
store, admin and Temporal UI in your browser once each one actually answers. From the Command Palette
the same task is `Tasks: Run Task` → `dev`.

| | URL | Pane |
|---|---|---|
| API | http://localhost:3000 (Swagger at `/admin/docs/`, `/store/docs/`) | `npm run --workspace=backend dev` |
| Temporal Worker | — polls the `proteus` task queue | `npm run --workspace=backend worker:dev` |
| Store | http://localhost:3001 | `npm run --workspace=store dev` |
| Admin | http://localhost:3002 | `npm run --workspace=admin dev` |
| Temporal UI | http://localhost:8088 | Docker |

Every pane reloads itself. The Worker runs under `tsx --watch`, so editing a workflow, a step action
or any service beneath one restarts it in about five seconds — and because `worker.ts` drains on
SIGTERM, a restart mid-execution finishes the in-flight step instead of losing it. There is nothing
to restart by hand.

`Tasks: Terminate Task` → `All Running Tasks` stops the four panes and leaves Docker up, which is
what you usually want between sessions. `npm run --workspace=backend db:stop` takes the containers
down too.

**Running a piece on its own**

The task is a convenience, not a requirement — each pane is just an npm script, and the table above
lists them. Note that `dev` stops the containerised Worker on the way up, because it and
`worker:dev` both poll `proteus` and whichever is free claims the task; start it again with
`docker compose -f apps/backend/docker-compose.yml start worker` if you want that one instead.

### Common tasks

```bash
# Type-check everything
npm run typecheck

# Run backend tests
npm run --workspace=backend test

# Run store tests
npm run --workspace=store test

# Lint and format
npm run check

# Generate OpenAPI spec + store client
npm run openapi:generate

# Generate DB migration after schema change
npm run --workspace=backend db:generate

# Run dependency-cruiser rules
npm run --workspace=backend check:deps

# Generate dependency graph SVG
npm run --workspace=backend check:deps:graph
```

---

## Documentation

| Document | What it covers |
|----------|---------------|
| [`docs/adding-a-module.md`](docs/adding-a-module.md) | Step-by-step guide to creating a new module (with checklist) |
| [`docs/error-handling.md`](docs/error-handling.md) | AppError, DB error mapping, validation, HTTP response shape |
| [`docs/middleware-and-openapi.md`](docs/middleware-and-openapi.md) | Declarative middleware, HTTP schemas, OpenAPI generation |
| [`docs/architecture-decisions.md`](docs/architecture-decisions.md) | Quick-reference map of all ADRs |
| [`docs/research/`](docs/research/) | Deep-dive research notes (cross-module deps, payment module, event systems) |
