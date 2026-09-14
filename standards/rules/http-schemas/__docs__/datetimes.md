# Datetime fields

A timestamp crossing the HTTP boundary, in both directions. This is the one contract in this package
with a rule behind it, because the failure it prevents is a type mismatch that only surfaces at a
distant call site. Everything else about writing a schema is in [schemas](./schemas.md).

## Structure

`dateToIso` and `timestamps` both live in `src/common.ts`, which is the only file exempt from the
rule below — the pipeline has to end in a `.datetime()` somewhere.

## Shape

```ts
export const dateToIso = z
  .date()
  .transform((d) => d.toISOString())
  .pipe(z.iso.datetime({ offset: true }))
```

## Rules

### A timestamp keeps one shape until the last moment

The column is `timestamptz`, Drizzle returns a `Date`, the DTO carries that `Date`, and the ISO
string is produced here, at the HTTP edge. `dateToIso` is that edge: it accepts a `Date` and outputs
an ISO 8601 string with an offset.

Writing `z.iso.datetime()` by hand types the field as `string` on the way *in*, so the backend can no
longer hand it the `Date` it is holding. That is the whole failure the pipeline exists to prevent,
and `z.input` — which entity types use, correctly — is what makes it invisible until some handler
several files away stops compiling.

### The standard trio is spread, not repeated

For `createdAt` / `updatedAt` / `deletedAt`, spread `...timestamps.shape`:

```ts
export const AdminUser = z.object({
  id: z.string(),
  name: z.string(),
  ...timestamps.shape,
}).openapi('AdminUser')
```

### Dates arriving as query params are coerced, not piped

`dateToIso` is the outbound direction. Filtering on a date field — `?createdAt[$gte]=2026-01-01` —
is the inbound one, and wants `createDateOperatorMap()`, which parses ISO strings into `Date`
objects with `z.coerce.date()`:

```ts
export function createDateOperatorMap() {
  const t = z.coerce.date().optional()
  return z.object({ $eq: t, $ne: t, $gt: t, $gte: t, $lt: t, $lte: t })
}
```

The two are not symmetric and should not be made so: outbound the backend holds a `Date` and the
client needs a string; inbound the client sends a string and the repository needs a `Date`.

## Enforcement

| Rule id | The paragraph it enforces |
|---|---|
| `schema-datetime-bypasses-date-to-iso` | that a timestamp goes through `dateToIso` rather than declaring `.datetime()` itself |

It matches any `.datetime()` call under `src/`, which catches both spellings — `z.iso.datetime()` and
`z.string().datetime()` — and does not fire on the word appearing in a comment, which a text search
would. `standards/README.md` covers how rules run, how their tests work, and how to suppress one.

### Exemptions

`src/common.ts`, as a glob in the rule, because `dateToIso` is defined there.

## What is deliberately not enforced

- **That a `Date`-typed field uses `dateToIso` at all.** The rule catches a hand-written
  `.datetime()`; it cannot catch a timestamp typed as `z.string()` and never validated, because
  nothing in the schema file says the column behind it is a `timestamptz`. That claim needs the
  model, and the model is in another workspace.
- **That the trio is spread rather than written out.** Three `dateToIso` fields named `createdAt`,
  `updatedAt` and `deletedAt` are correct, just repetitive. A rule refusing them would be a rule
  about brevity.
- **`{ offset: true }`.** It is inside `dateToIso`, so every field that goes through the pipeline
  gets it, and the rule already forces everything through the pipeline.

## Relationship with schemas

`z.input` over `z.infer` is [a schemas rule](./schemas.md#types-use-zinput-not-zinfer) and exists
almost entirely for this transform — `z.infer` would give the wire type, `string`, where the backend
needs to pass a `Date`.
