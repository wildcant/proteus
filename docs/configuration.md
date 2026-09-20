# Configuration

Every app reads its environment in exactly one file, validates it there, and exports the result.
Nothing else in `src/` touches `process.env` or `import.meta.env`. This is the same claim in three
places, which is why it is here rather than in any one app.

## Structure

| App | File | Imported as | Source |
|---|---|---|---|
| `apps/backend` | `src/env.ts` | `@env` | `process.env` |
| `apps/store` | `src/env.ts` | `#/env` | `import.meta.env` |
| `apps/admin` | `src/env.ts` | `#/env` | `import.meta.env` |

## Shape

```ts
const envSchema = z.object({
  VITE_BACKEND_URL: z.url(),
})

function createEnv() {
  const result = envSchema.safeParse(import.meta.env)

  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid environment variables:\n${issues}`)
  }

  return result.data
}

export const env = createEnv()
```

## Rules

### Read the environment once, at the top, through a schema

`process.env.FOO` is `string | undefined` whatever anyone believes about the deployment. A missing or
misspelt variable is therefore not an error — it is an `undefined` that flows into a connection
string, a URL or a comparison, and surfaces hours later as something that reads like a different bug.
The schema turns that into a startup failure that names the variable, and gives the rest of the app a
typed object where `DATABASE_URL` is a `string` because it could not have booted otherwise.

Coercion, defaults and derivation belong in the same file for the same reason: `MIGRATING` is
`z.coerce.boolean()` because the raw value is the string `"false"`, and `DATABASE_URL` is *computed*
from three variables by `resolveDatabaseUrl`. A caller reaching past `env` gets the string, not the
decision.

### Build-time literals stay outside `createEnv()`

`SHOW_DEVTOOLS` and `PREFILL_FORMS` are declared at module scope in the two frontends rather than
folded into the validated object, and the comment above each says why: as a direct
`import.meta.env.DEV` reference it stays a literal Vite can substitute, so the branch folds away and
the dev-only values tree-shake out of the production bundle. Through `env.SHOW_DEVTOOLS` they would
not. These live in `env.ts` like everything else, so the rule below does not have to know about them.

### The exemption is the file, not the read

`env.ts` is the only place exempt, and it is exempt wholesale — the validated object has to be built
out of the raw one somewhere. There is no second category. Config files that need a variable import
`env` like anything else: the ten `database.config.ts` files under `apps/backend/src` each do
`import { env } from '@env'` for their `dbCredentials`.

## Enforcement

| Rule id | The paragraph it enforces |
|---|---|
| `env-read-outside-env-module` | that `process.env` and `import.meta.env` appear only in `env.ts` |
| `env-read-outside-env-module-in-jsx` | the same claim in `.tsx`, which ast-grep parses as a different language |

Both live at the root of `standards/rules/`, because the claim spans all three apps and belongs to
none. `standards/README.md` covers how rules run, how their tests work, and how to suppress one.

Scope is each app's `src/`. Build config, scripts, test fixtures and Playwright setup are outside it
and read the environment freely — `packages/testing/fixtures/e2e-config.ts` sets
`process.env.VITE_BACKEND_URL` per suite, which is the machinery that makes an app's `env.ts` see
anything at all. There is no validated object for a build script to import, and inventing one to
satisfy a rule would be the rule writing the code.

## What is deliberately not enforced

- **That a variable is in the schema at all.** `env.MISSPELT` is a type error, so `typecheck` holds
  this from the other side.
- **That `.env.example` lists what the schema requires.** Nothing compares the two. A deploy missing
  a variable fails at boot with the name in the message, which is the check that matters.
- **That an optional variable's default is safe.** `TEMPORAL_TASK_QUEUE` defaults to `proteus` so a
  fresh environment boots — and so two deployments that never set it share a queue, and one's Worker
  executes the other's checkout. That trade is written in a comment at the declaration, which is
  where the decision is.
