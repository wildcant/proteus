# knip triage — the full report, without `include`

Measured 2026-09-11 on `dependency-hygiene-and-pnpm`, knip 6.35.1, `knip.jsonc` with
`"include": ["dependencies", "catalog"]` removed.

**436 findings**: 34 unused files, 2 unlisted dependencies, 3 unlisted binaries, 135 unused exports,
261 unused exported types, 1 duplicate export.

The question this answers: which of those are the tool being wrong, which are the config being
incomplete, and which are the repo being wrong. Nothing here is "suppress it because it's noisy" —
every ignore below has a reason that survives being read back in six months.

| Bucket | Findings | Verdict |
| --- | --- | --- |
| 1. Config — the tool can't see the reference | 10 | Ignore/entry, with a reason |
| 2. Config — generated code | 164 | Ignore the directory |
| 3. Barrels nothing goes through | ~79 | Cleanup |
| 4. `export` on a file-local symbol | 59 | Cleanup |
| 5. Dead code, zero references | ~35 | Delete |
| 6. `core/types/**` ports with no implementation | ~45 | Refactor — needs reading |
| 7. Redundant alias | 1 | Delete |

---

## Bucket 1 — false positives (10)

Each one is a real reference the module graph genuinely cannot reach.

| Finding | Why knip can't see it | Fix |
| --- | --- | --- |
| `scripts/checks/one-version.mts` | Invoked as `node scripts/checks/one-version.mts` from `verify.sh:126`. knip does not parse shell. | Root `entry: ["scripts/**/*.mts"]` |
| `packages/icons/scripts/export-template.ts` | Passed as `--templateSrc=` in `build:icons` and loaded by `await import(path.resolve(…))` in `build-icons/cli.ts:54`. | `packages/icons` entry |
| `apps/admin/src/types/router.ts` | `declare module '@tanstack/react-router'` augmentation. 17 route files depend on the `staticData.breadcrumb` it adds; nothing imports the file. | `apps/admin` entry |
| `.scratch/envia-poc/envia-poc.mjs` | `.scratch/` is the working record, not shipped code. | `ignoreFiles` / `ignore` |
| `cloudflare` ×2 (`index.workerd.ts`, `api-caller.ts`) | `import { env } from 'cloudflare:workers'` — a workerd built-in module namespace, not an npm package. | `ignoreDependencies: ["cloudflare"]` |
| `dropdb`, `createdb`, `dot` | System binaries (postgresql-client, graphviz), deliberately not declared. | `ignoreBinaries` |

The first three are the same shape as the three already in `knip.jsonc` — reached by string, by a
config flag, or by the type system rather than by an import. They belong in `entry`, not in an
ignore list, because they *are* entry points.

## Bucket 2 — generated code (164, 38% of the report)

All under `src/api/generated/`: 7 whole files, 16 exports, 141 types.

The 141 types are Orval's per-operation `*Result` aliases — two per endpoint, emitted whether or not
anything names them. There is no per-export knob; the only lever is Orval's tag list. Not a code
finding.

**Ignore `**/src/api/generated/**`.** `routeTree.gen.ts` and the two `registry.gen.ts` did not
appear, so they need no rule.

One thing worth keeping out of the ignore's shadow: the 7 unused *files* are whole admin API tag
groups the admin app never calls — `fulfillment-providers`, `fulfillment-sets`,
`payment-collections`, `payments`, `refund-reasons`, `shipping-options`, `shipping-profiles`. That is
a statement about admin feature coverage, not about dependencies, and it will stop being visible
once the directory is ignored. Worth writing down here rather than losing.

## Bucket 3 — barrels nothing goes through (~79)

Two shapes, one cause: the repo imports concrete paths, and the barrels were written anyway.

**(a) Barrel files with zero importers — 22 files, straight delete.**

`core/auth/index.ts`, `framework/http/index.ts`, and 20 module sub-barrels:
`{auth,cart,customer,inventory,pricing,product,region,store,user}/repositories/index.ts` and
`{cart,customer,fulfillment,inventory,notification,payment,pricing,product,region,store,user}/services/index.ts`.

Not uniform: `order`, `payment`, `notification` and `fulfillment` *do* have a live
`repositories/index.ts` (imported by `sync-providers.ts` and by module tests), which is why they are
absent from the list. So the convention is 4-for-24 — decide it rather than let it drift. The module
layout says `index.ts` is the module's *whole public surface*; sub-barrels are not in the closed list
of four root files. **Recommend: delete all 20 dead ones and convert the 4 live importers to
concrete paths.** One rule, no exceptions to remember.

**(b) Live barrels that over-export — trim the re-export line, keep the symbol.**

Every symbol below is alive; only the barrel's re-export of it is dead, because consumers import the
concrete path.

| Barrel | Dead re-exports |
| --- | --- |
| `core/utils/index.ts` | 12 values + 5 types (`BaseRepository`, `Module`, `createWithTransaction`, `Links`, …). `ContainerRegistrationKeys` / `Modules` / `NotificationTemplates` are the live ones — 150+ importers |
| `core/config/index.ts` | `ConfigManager`, `configManager`, 4 types. Only `defineAppConfig` is consumed |
| `core/errors/index.ts` | `dbErrorMapper` (used via `../errors/db-error-mapper.js`) |
| `framework/logger/index.ts` | `ConsoleLogger`, `WinstonLogger` (both used via concrete paths in the three container files) |
| `framework/scheduler/index.ts` | `BullMqCronScheduler` (used by its own test, via concrete path) |
| `link-modules/modules-definitions.ts` | `fulfillmentTable`, `orderTable`, `paymentCollectionTable` |
| `packages/ui/src/index.ts` | 11 toast primitives + `SidebarInput`, `SidebarMenuSkeleton`. Apps use the composed `Toaster` and imperative `toast.*`; the primitives are `toast.tsx`'s internals. Trimming `index.ts` — which is hand-written — survives `shadcn:re-eject`; editing the component files would not |
| `admin components/data-table/index.ts` | `ThumbnailCell` + 10 types |
| `admin components/data-grid/index.ts` | `DataGridSkeleton` |

## Bucket 4 — `export` on a file-local symbol (59)

Referenced only inside their own file. Drop the `export` keyword; nothing else changes.

The biggest sub-pattern is the frontend query layer: 10+ `*QueryKeys` factories exported and used
only by the `queryOptions` beside them (`authQueryKeys`, `customersQueryKeys`, `ordersQueryKeys`,
`productsQueryKeys`, `addressesQueryKeys`, `paymentMethodsQueryKeys`, `countriesQueryKeys`, …). The
factory-per-api-module is the house pattern and stays; the `export` on it is autopilot, and
un-exporting keeps cache-key ownership inside the api module where it belongs.

Also here: `PRODUCT_SORTS`, `MODAL_NAMES`, `MARKET_COOKIE`, `CHECKOUT_RETURN_PATH`,
`ORDERS_DEFAULT_LIMIT`, `PRODUCTS_DEFAULT_OFFSET`, `DECLINED_MESSAGE`, `readThemeTokens`,
`createWorkflowRegistry`, `MANUAL_PROVIDER_KEY`, `computeProviderKeys` ×2, `computeProviderConfigs`,
the four Drizzle `pgEnum` consts (`customerStatusEnum`, `notificationStatusEnum`,
`paymentCollectionStatusEnum`, `paymentSessionStatusEnum` — each referenced only by the column in its
own file), `MOCK_CUSTOMER_ID`, `MOCK_PAYMENT_METHOD_ID`.

Note `ignoreExportsUsedInFile: true` would hide this whole bucket in one line. Don't — it is 59 real
one-word edits, and after them the setting has nothing left to hide.

## Bucket 5 — dead code, zero references (~35)

- `apps/backend/src/core/utils/validate-body.ts` — the whole file. Route validation goes through
  `definitions.ts` schemas; nothing has called this since.
- 12 unused hooks: admin `useProduct`, `useOrder`, `useUser`, `useRegion`, `useCustomer`,
  `useNotifications`, `useProductOption`, `useProductVariant`, `useCreateOrderFulfillment`,
  `useCreateOrderShipment`, `useMarkOrderDelivered`; store `useCreateCart`. Several have a
  `*QueryOptions` that only they called — those go with them.
- 8 admin skeletons in `components/common/skeleton.tsx` (`HeadingSkeleton`, `TextSkeleton`,
  `IconButtonSkeleton`, `GeneralSectionSkeleton`, `TableFooterSkeleton`, `TableSkeleton`,
  `TableSectionSkeleton`, `JsonViewSectionSkeleton`) — 3 with no reference of any kind.
- Test helpers: `generateAuthVerificationDTO`, `generateAuthPasswordResetTokenDTO`,
  `moduleMigrations`, `shutdown` (`tests/db/client.ts`).
- `CheckoutSummaryDisclosure`, `paymentRowVariants`, `fulfillmentSequence`, `priceColumnHeader`,
  `suggestLocaleCode`, `productVariantInventoryItemRelations`.
- `DEFAULT_MARKET` in `apps/store/tests/setup/utils.ts` — a real duplicate: `markets.spec.ts:15`
  redeclares the same constant locally instead of importing it. Import it and delete the copy.

## Bucket 6 — `core/types/**` ports with nothing behind them (~45)

36 under `apps/backend/src/core/types/`, 14 under `framework/`. This is the bucket the wider scope
was worth turning on for, and the only one that needs reading rather than a mechanical edit.

**Filter vocabulary that was never wired (~11).** `FilterableNotificationProviderProps`,
`FilterablePaymentCollectionProps`, `FilterablePaymentSessionProps`, `FilterablePaymentProps`,
`FilterableCaptureProps`, `FilterableRefundProps`, `FilterableRefundReasonProps`,
`FilterablePaymentMethodProps`, `FilterableProductProductOptionProps`,
`FilterableProductProductOptionValueProps`. A Medusa-shaped list-filter vocabulary copied in ahead of
the list methods that would take it. They are also `interface` in a codebase whose convention is
`type` — the backend is not Biome-enforced, so they slipped. Delete unless a list endpoint is
actually queued.

**DTOs ahead of the operation (~25).** `CreatePaymentDTO`, `CreatePaymentMethodDTO`,
`DeletePaymentMethodDTO`, `SetDefaultPaymentMethodDTO`, `CaptureDTO`, `RefundDTO`, `PaymentMethodDTO`,
`UpdateInventoryLevelDTO`, `UpdateReservationItemDTO`, `CreateFulfillmentItemDTO`,
`CreateFulfillmentAddressDTO`, `CreateProductImageInput`, `UpdateProductImageDTO`,
`UpdateProductOptionValueDTO`, `CreateStoreCurrencyDTO`, `VariantInventoryAvailabilityDTO`,
`LineItemWithProductDTO`, `VariantProductDTO`, `ProductScopedOptionValueDTO`,
`ProductProductOptionValueDTO`, `VariantRemovalReason`, `ApplicationLifecycle`, `IdParams`,
`AuthProviderConfig`, `WritableLinkDTOMap`, and the four `config/types.ts` shapes.

Each is one of two things, and they need telling apart one at a time:
- the port for an operation the service *does* have but types inline — a real gap; the fix is to use
  the DTO, not delete it;
- speculative — delete.

A port type nothing implements is a lie about the module's interface, which is why this is the
bucket with the most value per finding and the least mechanical fix.

## Bucket 7 — duplicate export (1)

`packages/http-schemas/src/store/fulfillment/payloads.ts:41` —
`export const CreateGeoZone = CreateGeoZoneInput`, an alias whose only consumer is the
`CreateGeoZoneBody` type on the next line. Delete the alias, derive the type from
`CreateGeoZoneInput`.

(The `CreateGeoZone` the backend test factories import is a different symbol, from
`apps/backend/src/schema.js`. Unrelated.)

---

## Turning it on

Buckets 1 and 2 first — they are config, and until they land 174 of the 436 rows are noise that
buries the other 262.

Then widen the gate in two steps rather than one, so it is never red on day one:

1. **Now**: `files`, `unlisted`, `binaries`, `duplicates`, `dependencies`, `catalog`. After Bucket 1
   + 2 config, that is Buckets 3a and 7 — 23 findings, all mechanical.
2. **After Buckets 4, 5, 6 are cleared**: add `exports` and `types`.

Leave `ignoreExportsUsedInFile` at its default. Bucket 4 is the reason.
