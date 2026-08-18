# 04 — Store order API

**What to build:** The 2 store-facing order endpoints that let authenticated customers view their own orders. After this ticket, customers can see their order history and individual order details through the storefront API.

**Blocked by:** 01 (Order module core)

**Status:** ready-for-agent

## API routes

- [ ] `GET /store/orders` -- list orders filtered by `customerId` from auth context, paginated
- [ ] `GET /store/orders/:id` -- retrieve single order with line items, shipping methods, transactions, computed totals. Scoped to authenticated customer's orders only

## HTTP schemas

- [ ] `packages/http-schemas/src/store/order/` -- entities (Zod schemas with `.openapi()`), responses, queries, index.ts
- [ ] `packages/http-schemas/src/store/index.ts` -- add `export * from './order/index.js'`

## Auth guard

- [ ] Store endpoints only return orders belonging to the authenticated customer (filter by `customerId` extracted from auth context, same pattern as other store endpoints)

## Route pattern

- [ ] Follow existing store route patterns: named exports, schema declarations, auth middleware
