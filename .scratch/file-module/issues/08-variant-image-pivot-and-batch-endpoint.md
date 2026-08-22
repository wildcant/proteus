# 08 — Variant-image pivot + batch endpoint

**What to build:** A `product_variant_image` pivot table linking images to variants, two new service methods (`addImageToVariant`, `removeImageFromVariant`), and a batch endpoint at `POST /admin/products/:id/images/:imageId/variants/batch`. The batch endpoint accepts `{ add?: string[], remove?: string[] }` (variant IDs), runs both operations in parallel via `batchImageVariantsWorkflow`, and cleans up variant thumbnails when a removed image was the variant's thumbnail. Each step has compensation for rollback.

**Blocked by:** 07 — Inline product image handling

**Status:** ready-for-agent

- [ ] `product_variant_image` table: `id` (prefix `pvimg_`), `variantId` FK to `product_variant` (cascade delete), `imageId` FK to `product_image` (cascade delete), timestamps, unique index on `(variantId, imageId) WHERE deleted_at IS NULL`
- [ ] `ProductVariantImageRepository` extending `BaseRepository(productVariantImageTable)`
- [ ] Repository registered in the product module's local container
- [ ] Types: `VariantImageInput = { imageId: string; variantId: string }`, `ProductVariantImageDTO`, `FilterableProductVariantImageProps` in `core/types/product/`
- [ ] `addImageToVariant` and `removeImageFromVariant` added to `IProductModuleService` and `ProductModuleService`
- [ ] `addImageToVariant` creates pivot records, returns `{ id }[]`
- [ ] `removeImageFromVariant` queries matching pairs, soft-deletes found records
- [ ] `batchImageVariantsWorkflow`: parallelizes add/remove steps, clears variant thumbnails when removed image was the thumbnail
- [ ] Add step compensation: removes added pivot records on failure
- [ ] Remove step compensation: re-adds removed pivot records on failure
- [ ] HTTP schemas: `AdminBatchImageVariantPayload`, `AdminBatchImageVariantResponse`
- [ ] `POST /admin/products/:id/images/:imageId/variants/batch` route with authentication
- [ ] Drizzle migration generated
- [ ] Integration tests: add creates pivots, duplicate pair rejected, remove soft-deletes, non-existent pair is no-op, batch parallelizes add/remove, batch clears variant thumbnail
