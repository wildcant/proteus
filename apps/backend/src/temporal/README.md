# `src/temporal/` — shared Temporal plumbing

This folder is the Temporal plumbing that more than one subsystem builds on: the workflow engine
(`src/core/workflows/temporal/`) today, the event bus (`src/core/event-bus/`) next. That is the
whole rule for what belongs here. A change to any file in this folder changes behaviour for every
one of them at once, so it needs to be weighed against all of them — and, conversely, anything that
serves only one of them belongs in that subsystem's own folder, not here. `check:deps` enforces the
direction with `shared-temporal-stays-shared`: the subsystems import this folder, this folder never
imports them.

`payload-converter.ts` is the clearest case of shared **on purpose**. Two converters would mean two
encodings of `BigNumber` and `Date` on the wire, and a value written by one subsystem and read by
the other would come back subtly wrong rather than failing — corrupt data instead of an error. The
same argument covers `failures.ts` / `failure-details.ts`, which are the one encoding of an error
crossing the boundary, and `client.ts`, which is the one way to open a connection with that
converter attached.

`config.ts` holds only `PAYLOAD_CONVERTER_PATH` for the same reason. The queue name, the workflow
bundle path and the driver's workflow type are the workflow engine's alone and live in
`src/core/workflows/temporal/config.ts`.

`ping.ts` is the exception, and the only one: it is an operator script (`npm run temporal:ping`)
that starts the workflow driver's own `pingWorkflow` on the workflow task queue, so it does reach
into `src/core/workflows/temporal/`. It is exempted from the `check:deps` rule by name because
nothing imports it — it is a process entrypoint, so the dependency ends there rather than dragging
the engine into anything that uses this folder. A second probe for a second subsystem belongs with
that subsystem.
