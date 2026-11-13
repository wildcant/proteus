# Deployment

Production runs on Cloudflare, with Postgres on Supabase. This guide covers a deployment from an
empty Cloudflare account, and starting a new store from this codebase.

## What runs where

| Piece | Cloudflare product | Name | Config |
|---|---|---|---|
| API | Worker | `proteus-backend` | `apps/backend/wrangler.jsonc` |
| Storefront | Worker (TanStack Start, SSR) | `proteus` | `apps/store/wrangler.jsonc` |
| Admin | Pages (static build) | `proteus-admin` | `deploy` script in `apps/admin/package.json` |
| Event bus | Queue + dead-letter queue | `proteus-events`, `proteus-events-dlq` | `apps/backend/wrangler.jsonc` |
| Uploaded and seed images | R2 bucket with a public URL | `proteus-assets` | `S3_*` in `.env` |
| Dotenv private keys | R2 buckets | `dotenv-keys`, `dotenv-admin` | `pull-keys` in root `package.json` |
| Database | Supabase Postgres | — | `POOLER_DATABASE_URL`, `DIRECT_DATABASE_URL` |

Production needs no Temporal. On workerd the backend runs workflows in-process with the simple
adapter (see `apps/backend/README.md`).

## Environment and keys

Production values live in the root `.env`, encrypted with dotenvx. Every app reads that one file.

- **Backend and storefront Workers** read the values at runtime, as Worker secrets.
- **Storefront and admin builds** read `VITE_BACKEND_URL` at build time and bake it into the bundle.
  If the backend URL changes, redeploy both. Pushing secrets alone does not update them.

Three private keys decrypt the env files. R2 stores them in two buckets, so access to the
production key can be granted separately:

| Key | Decrypts | R2 object |
|---|---|---|
| `DOTENV_PRIVATE_KEY_LOCAL` | `.env.local` | `dotenv-keys/.env.keys` |
| `DOTENV_PRIVATE_KEY_TEST` | `.env.test` | `dotenv-keys/.env.keys` |
| `DOTENV_PRIVATE_KEY` | `.env` (production) | `dotenv-admin/.env.keys.production` |

`pnpm run pull-keys` downloads both objects and writes all three keys to `.env.keys`, which is
gitignored. dotenvx reads that file automatically, so no command needs `-fk`.

Check that a file decrypts before you use it:

```bash
dotenvx get -f .env 2>&1 | grep -c MISSING_PRIVATE_KEY   # must print 0
```

### Production variables

| Variable | Value |
|---|---|
| `POOLER_DATABASE_URL` | Supabase transaction pooler, port 6543. The Workers use this one. |
| `DIRECT_DATABASE_URL` | Supabase direct connection, port 5432. Migrations use this one. |
| `VITE_BACKEND_URL` | `https://proteus-backend.<subdomain>.workers.dev` |
| `STORE_URL` | `https://proteus.<subdomain>.workers.dev` |
| `ADMIN_URL` | `https://proteus-admin.pages.dev` |
| `CORS_ORIGIN` | Comma-separated: the admin URL and the store URL |
| `JWT_SECRET` | A long random string, for example `openssl rand -base64 48` |
| `STRIPE_*` | Stripe secret, webhook secret and publishable keys |
| `RESEND_API_KEY`, `RESEND_FROM` | Resend key and a sender on a verified domain |
| `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | An R2 API token with read and write access to the assets bucket |
| `S3_BUCKET`, `S3_REGION`, `S3_PREFIX` | `proteus-assets`, `auto`, `images` |
| `S3_FILE_URL` | The bucket's public `https://pub-….r2.dev` URL |

`<subdomain>` is the account's workers.dev subdomain. Read it from the API, not from memory, because
it can be renamed:

```bash
curl -s -H "Authorization: Bearer <token>" \
  https://api.cloudflare.com/client/v4/accounts/<account-id>/workers/subdomain
```

## First deployment

Run every command from the repository root unless a step says otherwise. Wrangler commands need
`CLOUDFLARE_ACCOUNT_ID` set when the login can see more than one account.

### 1. Create the database

1. Create a Supabase project.
2. Copy both connection strings from **Connect**: the direct connection (port 5432) and the
   transaction pooler (port 6543).
3. Store them in `.env`. Run these in your own terminal, so the password stays out of logs and
   chats:

   ```bash
   dotenvx set DIRECT_DATABASE_URL 'postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres' -f .env
   dotenvx set POOLER_DATABASE_URL 'postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres' -f .env
   ```

### 2. Create the Cloudflare resources

```bash
cd apps/backend
pnpm exec wrangler queues create proteus-events
pnpm exec wrangler queues create proteus-events-dlq
pnpm exec wrangler r2 bucket create proteus-assets
pnpm exec wrangler r2 bucket dev-url enable proteus-assets   # prints the public URL for S3_FILE_URL
pnpm exec wrangler pages project create proteus-admin --production-branch=main
```

Create an R2 API token for the assets bucket in the dashboard (**R2 → Manage API tokens**). Then
fill in the remaining variables from the table above with `dotenvx set <KEY> <value> -f .env`.

### 3. Migrate and seed

```bash
cd apps/backend
dotenvx run -f ../../.env -- pnpm run db:migrate
```

`db:migrate` sets `MIGRATING=true`, so it connects through `DIRECT_DATABASE_URL`. It runs
`drizzle-kit migrate` once per module and once for the link modules.

Then pick one seed:

```bash
# Markets only: regions, countries, the store and payment providers. No catalogue, no accounts.
dotenvx run -f ../../.env -- tsx --dns-result-order=ipv4first scripts/seed-markets.ts
pnpm run db:seed:permissions

# Full demo: catalogue, images, users, a cart, shipping options.
FILE_PROVIDER=s3 dotenvx run -f ../../.env -- tsx --dns-result-order=ipv4first scripts/seed-dev.ts
```

The full seed needs `FILE_PROVIDER=s3`. Without it, the seed copies photos to local disk and
stores `localhost` URLs.

> **Warning:** the full seed creates accounts with the password `123`, including a super admin
> (`admin@example.com`). On a public deployment, change those passwords or delete the accounts
> right after seeding.

### 4. Push secrets and deploy

```bash
pnpm run sync-secrets:backend
pnpm run sync-secrets:store
pnpm --filter backend run deploy
pnpm --filter store run deploy
pnpm --filter admin run deploy
```

`wrangler pages deploy` names the deployment after the current git branch. Only the production
branch (`main`) updates `proteus-admin.pages.dev`. From any other branch, deploy the admin with
`--branch=main`:

```bash
cd apps/admin
dotenvx run --env-file=../../.env -- vite build
pnpm exec wrangler pages deploy dist --project-name=proteus-admin --branch=main
```

### 5. Verify

`/health` does not touch the database, so a 200 there proves nothing about Postgres. Check
endpoints that read data:

```bash
B=https://proteus-backend.<subdomain>.workers.dev
curl -s -o /dev/null -w "%{http_code}\n" "$B/store/countries?scope=sellable"
curl -s -o /dev/null -w "%{http_code}\n" "$B/store/products?limit=1&countryCode=us"
curl -s -o /dev/null -w "%{http_code}\n" -L https://proteus.<subdomain>.workers.dev/
```

Then open the admin and log in. If a request fails, tail the Worker while you repeat it:

```bash
cd apps/backend
pnpm exec wrangler tail proteus-backend --format pretty
```

## Updating a deployment

| Change | Steps |
|---|---|
| Code | Deploy each app that changed. A backend change that the admin or store depends on goes out first. |
| Schema | Run `db:migrate` against production before you deploy the backend. |
| A secret | `dotenvx set` it in `.env`, run `sync-secrets:backend` and `sync-secrets:store`, and commit `.env`. |
| `VITE_BACKEND_URL` | Same as a secret, then redeploy the store and the admin. |

## Starting a new store from this codebase

A new store is a fork with its own names, its own keys and its own production resources. In the
steps below, `<store>` is the new store's short name.

1. **Fork and add the upstream remote**, so fixes can be merged in later:

   ```bash
   git clone <proteus-repo> <store> && cd <store>
   git remote rename origin upstream
   git remote add origin <new-repo>
   ```

2. **Rename the deployable resources.** Every `proteus-` resource name changes to `<store>-`:

   | File | Change |
   |---|---|
   | `apps/backend/wrangler.jsonc` | `name`, the queue producer, the queue consumer and `dead_letter_queue` |
   | `apps/store/wrangler.jsonc` | `name` |
   | `apps/admin/package.json` | `--project-name` in `deploy` |
   | `package.json` | the Worker names in `sync-secrets:*` |
   | `scripts/pull-keys.sh` | the R2 paths of both key objects (for example `dotenv-keys/<store>/.env.keys`) |
   | `apps/backend/docker-compose.yml`, `apps/backend/docker-compose.test.yml` | add `name: <store>` and `name: <store>-test` at the top, so local Docker containers and volumes stay apart from Proteus |

3. **Generate new keys.** The fork must not share keys with Proteus. For each of `.env.local`,
   `.env.test` and `.env`: remove the `DOTENV_PUBLIC_KEY` header and the encrypted values, set the
   values again with `dotenvx set`, and dotenvx creates a new key pair. Blank the production values
   in `.env` until step 4 fills them in.

4. **Run [First deployment](#first-deployment)** with the `<store>` names. Use a new Supabase
   project, new queues, a new assets bucket and a new Pages project.

5. **Upload the new private keys** to the R2 paths in `scripts/pull-keys.sh`: the local and test
   keys to the first object, the production key to the second. Another machine can then decrypt
   the env files with `pnpm run pull-keys`.

To run a fork and Proteus on one machine at the same time, give the fork its own Docker Compose
project, database and bucket names, and its own host ports. Set `name:` at the top of both compose
files. Change the host side of each port mapping in the compose files, and change the ports in the
app `dev` scripts and the env files.

## Merging Proteus into a fork

A fork gets Proteus's fixes by merging `upstream/main` on a branch, then merging that branch with a
pull request:

```bash
git fetch upstream
git log --oneline main..upstream/main   # what is new
git switch -c sync/proteus-<date> main
git merge upstream/main
```

1. **Resolve conflicts.**
   - In the files the fork renamed (compose files, `wrangler.jsonc`, the `package.json` scripts,
     `env.ts`), keep the fork's names and ports and take the rest of the upstream change.
   - Keep the fork's `.env*` files (`git checkout --ours .env .env.local .env.test`). Upstream's values
     are encrypted with Proteus's keys, so the fork cannot read them. Add any new variable with
     `dotenvx set`.
   - Don't hand-merge generated files. Take either side, then run the generators (`pnpm run
     openapi:generate`, the backend `*:generate` scripts, the design exporters).
2. **If upstream added a migration**, run `pnpm --filter backend run db:migrate:dev`.
3. **Run `pnpm run verify`**, push the branch and open a pull request.
4. **Merge the pull request with a merge commit** (`gh pr merge <n> --merge`), never a squash or a
   rebase. A merge commit records `upstream/main` as a parent, so git knows those commits are in the
   fork. A squash copies the changes but not that record: the next sync applies the same commits
   again and can conflict with its own earlier result. To make this impossible, turn off squash and
   rebase merging in the fork's repository settings, or protect its `main` so it accepts merge
   commits only.

If a sync was squashed, check that git still lists the upstream commits as missing
(`git log --oneline main..upstream/main`). Then revert the squash commit on a branch, merge
`upstream/main` into that branch, and merge its pull request with a merge commit.

## Known failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Every data endpoint returns 500 with `Failed query: …`, but `/health` is 200 | The database is unreachable: a paused Supabase project, a deleted project, or a stale URL | Check the project status in Supabase. Free-tier projects pause after about a week without traffic. Restore it, check the URLs in `.env`, then push the secrets again. |
| The storefront logs `Falling back to the default market: could not list the store countries.` | Same as above. The store cannot load markets from the backend. | Fix the backend first. |
| The admin shows `Failed to fetch` | The admin bundle calls a backend URL that does not resolve, often after a workers.dev subdomain rename | Update `VITE_BACKEND_URL`, `STORE_URL` and `CORS_ORIGIN`, push the secrets, and redeploy the store and admin |
| `[MISSING_PRIVATE_KEY] could not decrypt …` | The key for that env file is not in `.env.keys` | Run `pnpm run pull-keys` |
| A Worker URL returns `error code: 1042` | The workers.dev route is disabled for that Worker | Enable it, or use the URL the app is actually served from |
| Images point at `localhost` | The seed ran without `FILE_PROVIDER=s3` | Seed again with `FILE_PROVIDER=s3` |
