# 07 — Inline product image handling on create/update

**What to build:** Product create and update accept an `images` array and `thumbnail` field. Creating a product with `images: [{ url: "..." }, { url: "..." }]` creates `product_image` rows ranked by array index and auto-sets the thumbnail to the first image URL when none is provided. Updating a product with `images` performs collection replacement: new entries are created, entries matching an existing `id` are kept with updated rank, and existing images absent from the array are soft-deleted. The product detail endpoint (`GET /admin/products/:id`) includes images ordered by rank; the list endpoint (`GET /admin/products`) returns only the thumbnail.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `CreateProductDTO` gains `images?: Array<{ url: string }>` field
- [ ] `UpdateProductDTO` gains `images?: Array<{ id?: string; url: string }>` field
- [ ] `ProductModuleService.createProducts` creates `product_image` rows with `rank` = array index
- [ ] `ProductModuleService.createProducts` auto-sets `thumbnail` to `images[0].url` when no thumbnail provided
- [ ] `ProductModuleService.createProducts` uses explicit thumbnail when provided
- [ ] `ProductModuleService.updateProducts` performs collection replacement: creates new images, keeps existing by `id` with updated rank, soft-deletes removed images
- [ ] `ProductModuleService.updateProducts` auto-sets thumbnail following same rule as create
- [ ] HTTP schemas updated: `AdminProductImage` entity (`id`, `url`, `rank`), `AdminCreateProduct` gains `images` + `thumbnail`, `AdminUpdateProduct` gains `images` + `thumbnail`
- [ ] `AdminProductResponse` (detail) includes `images` array
- [ ] `AdminProductsResponse` (list) does NOT include `images` — thumbnail only
- [ ] `GET /admin/products/:id` returns images ordered by rank ASC
- [ ] `GET /admin/products` returns products without images array
- [ ] Orval regeneration updates product client types
- [ ] Integration tests: create with images + auto-thumbnail, create with explicit thumbnail, update collection replacement (create/keep/delete), update re-ranking, update auto-thumbnail
