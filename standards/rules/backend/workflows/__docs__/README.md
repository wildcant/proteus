# Workflows

`src/workflows/` is where a mutation that spans two modules is orchestrated, together with the
compensation that unwinds it. One domain folder per area, each holding its workflows, the steps they
compose and the pure utils either may call.

| Document | Use case |
|---|---|
| [Workflows](./workflows.md) | **Making several modules change together, atomically.** Use when one action writes across a module boundary and a failure halfway would leave the rest standing. |

Deciding whether you need one at all is the last question in
[route helpers](../../api/__docs__/route-helpers.md); the engine that runs them is mechanism and
lives in [`src/core/workflows/README.md`](../../../../../apps/backend/src/core/workflows/README.md).
