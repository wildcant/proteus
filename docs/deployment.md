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
| Uploaded and seed images, hero media | R2 bucket with a public URL | `proteus-assets` | `S3_*` in `.env` |
| Image resizing | Images binding | `IMAGES` | `apps/store/wrangler.jsonc` |
| Database connection pool | Hyperdrive | `proteus-db` | `apps/backend/wrangler.jsonc` |
| Dotenv private keys | R2 buckets | `dotenv-keys`, `dotenv-admin` | `pull-keys`, `push-keys` in root `package.json` |
| Database | Supabase Postgres | — | `POOLER_DATABASE_URL`, `DIRECT_DATABASE_URL` |

Production needs no Temporal. On workerd the backend runs workflows in-process with the simple
adapter (see `apps/backend/README.md`).

## Environment and keys

Production values live in the root `.env`, encrypted with dotenvx. Every app reads that one file.

- **The backend Worker** reads the values at runtime, as Worker secrets.
- **Storefront and admin builds** read the `VITE_*` values at build time and bake them into the
  bundle. If one changes, redeploy both. The storefront Worker has no secrets: at runtime it reads
  only its bindings.

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
| `JWT_SECRET` | At least 32 random characters. `cloudflare:create` generates one. |
| `STRIPE_*` | Stripe secret, webhook secret and publishable keys. Only with `stripe` turned on (below). |
| `RESEND_API_KEY`, `RESEND_FROM` | Resend key and a sender on a verified domain. Only with `resend` turned on. |
| `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | An R2 API token with read and write access to the assets bucket |
| `S3_BUCKET`, `S3_REGION`, `S3_PREFIX` | `proteus-assets`, `auto`, `images` |
| `S3_FILE_URL`, `VITE_IMAGE_ORIGIN`, `VITE_MEDIA_ORIGIN` | The bucket's public `https://pub-….r2.dev` URL |

### Optional integrations

Stripe and Resend are optional. `projectConfig.providers` in `apps/backend/src/config.ts` lists the
ones the store uses:

```ts
providers: {
  payment: ['stripe'],
  notification: ['resend'],
},
```

A store that takes no card payments removes `stripe` and leaves the `STRIPE_*` variables unset. With
one turned on and its variables missing, the backend refuses to start and names each missing
variable. The tests turn every integration on whatever the store chose, so removing one never
breaks the suite.

Removing an integration from a database that already has it seeded leaves its provider row enabled.
Disable it before seeding markets, which link every enabled payment provider to every region:

```sql
update payment_provider set is_enabled = false where id = 'pp_stripe_default';
```

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

1. Create a Supabase project, in the region closest to the store's shoppers.
2. Turn off its Data API (**Project Settings → Data API**). The backend connects to Postgres
   directly. Left on, the Data API serves the `public` schema over REST with the anon key, and the
   migrated tables have no row-level security.
3. Copy both connection strings from **Connect**: the direct connection (port 5432) and the
   transaction pooler (port 6543).
4. Store them in `.env`. Run these in your own terminal, so the password stays out of logs and
   chats:

   ```bash
   dotenvx set DIRECT_DATABASE_URL 'postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres' -f .env
   dotenvx set POOLER_DATABASE_URL 'postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres' -f .env
   ```

The direct host is IPv6-only on the free plan. If migrations cannot reach it from your network, use
the session pooler (port 5432 on the pooler host) as `DIRECT_DATABASE_URL` instead. The transaction
pooler does not support migrations.

### 2. Create the Cloudflare resources

```bash
pnpm exec wrangler login
pnpm run cloudflare:create proteus
```

The script creates the queues, the assets bucket with its public URL and the admin's upload rule,
the admin Pages project, the Hyperdrive config, and the two key buckets. It writes the Hyperdrive ID
into `apps/backend/wrangler.jsonc`, and fills `JWT_SECRET`, `FILE_PROVIDER`, `S3_BUCKET`, `S3_REGION`,
`S3_ENDPOINT`, `S3_FILE_URL`, `VITE_IMAGE_ORIGIN` and `VITE_MEDIA_ORIGIN` in `.env`. A rerun skips what
exists.

Then, in the dashboard:

1. **Turn on Images** (**Images → Enable**). The storefront resizes product photos with it.
2. **Create an R2 API token** (**R2 → Manage API tokens → Create Account API token**): **Object Read &
   Write**, limited to the assets bucket, no TTL, no IP filter. The backend Worker signs with it, and
   so do the admin's uploads from the browser, so neither a TTL nor an IP filter fits. Store the
   **Access Key ID** and **Secret Access Key**, not the Token value:

   ```bash
   dotenvx set S3_ACCESS_KEY_ID <access key id> -f .env
   dotenvx set S3_SECRET_ACCESS_KEY <secret access key> -f .env
   ```

3. **Fill the URLs** in `.env`: `VITE_BACKEND_URL`, `STORE_URL`, `ADMIN_URL` and `CORS_ORIGIN`, from the
   table above.

Upload the keys, so another machine can decrypt the env files:

```bash
pnpm run push-keys
```

Upload the storefront's large media (the home hero's video and posters), which is not committed:

```bash
cd apps/store/public
for file in media/hero/*; do
  pnpm exec wrangler r2 object put "proteus-assets/$file" --file "$file" --remote \
    --cache-control 'public, max-age=31536000, immutable'
done
```

### 3. Migrate and seed

```bash
cd apps/backend
dotenvx run -f ../../.env -- pnpm run db:migrate
```

`db:migrate` sets `MIGRATING=true`, so it connects through `DIRECT_DATABASE_URL`. It runs
`drizzle-kit migrate` once per module and once for the link modules.

Then pick one seed:

```bash
# A real store: providers, permissions, markets, and its first admin. No catalogue.
pnpm run db:seed:providers
pnpm run db:seed:permissions
dotenvx run -f ../../.env -- tsx --dns-result-order=ipv4first scripts/seed-markets.ts
pnpm run admin:create

# Full demo: catalogue, images, users, a cart, shipping options.
FILE_PROVIDER=s3 dotenvx run -f ../../.env -- tsx --dns-result-order=ipv4first scripts/seed-dev.ts
```

`admin:create` asks for a name, an email and a password, and makes a super admin. Run it in your own
terminal: the password is typed, not passed as an argument, so it stays out of shell history.

The full seed needs `FILE_PROVIDER=s3`. Without it, the seed copies photos to local disk and
stores `localhost` URLs.

> **Warning:** the full seed creates accounts with the password `123`, including a super admin
> (`admin@example.com`). On a public deployment, change those passwords or delete the accounts
> right after seeding.

### 4. Push secrets and deploy

```bash
pnpm run sync-secrets:backend
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
| A secret | `dotenvx set` it in `.env`, run `sync-secrets:backend`, and commit `.env`. |
| A `VITE_*` value | `dotenvx set` it in `.env`, commit it, then redeploy the store and the admin. |

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
   | `package.json` | the Worker name in `sync-secrets:backend` |
   | `scripts/pull-keys.sh`, `scripts/push-keys.sh` | the R2 paths of both key objects (for example `dotenv-keys/<store>/.env.keys`) |
   | `apps/backend/src/config.ts` | `projectConfig.providers`: the integrations the store uses |
   | `apps/backend/docker-compose.yml`, `apps/backend/docker-compose.test.yml` | add `name: <store>` and `name: <store>-test` at the top, so local Docker containers and volumes stay apart from Proteus |

3. **Generate new keys.** The fork must not share keys with Proteus. For each of `.env.local`,
   `.env.test` and `.env`: remove the `DOTENV_PUBLIC_KEY` header and the encrypted values, set the
   values again with `dotenvx set`, and dotenvx creates a new key pair. Blank the production values
   in `.env` until step 4 fills them in.

4. **Run [First deployment](#first-deployment)** with the `<store>` names:
   `pnpm run cloudflare:create <store>` creates the new resources, and `pnpm run push-keys` uploads the
   new keys. Use a new Supabase project.

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
| A wrangler command in one app fails with `Authentication error [code: 10000]` for an account you are not logged in to | Each app caches the account it last used in `node_modules/.cache/wrangler/wrangler-account.json`, and that app's cache predates a login to another account | Set `CLOUDFLARE_ACCOUNT_ID`, or copy the root's `node_modules/.cache/wrangler/wrangler-account.json` over the app's |
| The backend refuses to start: `STRIPE_…: Required while "stripe" is turned on` | An integration is on in `src/config.ts` without its keys | Set the keys, or remove the integration from `projectConfig.providers` |
| The backend refuses to start: `JWT_SECRET: Too small` | `JWT_SECRET` is empty or shorter than 32 characters | `dotenvx set JWT_SECRET "$(openssl rand -base64 48)" -f .env`, then push the secrets |
