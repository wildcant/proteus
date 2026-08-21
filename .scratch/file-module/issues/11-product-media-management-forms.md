# 11 — Product media management forms (edit modal + create section)

**What to build:** Two UI surfaces for managing product images: (1) an edit media modal at `/products/:id/media` for existing products, and (2) a media section in the product create form. Both support drag-to-reorder, thumbnail selection, image deletion, and adding new images via the upload drop zone. On submit, new files are uploaded to `POST /admin/uploads`, blob URLs are replaced with storage URLs, and the product is created/updated with the final `images` + `thumbnail` payload.

**Blocked by:** 10 — ProductMediaSection on product detail page

**Status:** ready-for-agent

- [ ] `/products/:id/media` route added to admin router, renders `RouteFocusModal` with `EditProductMediaForm`
- [ ] `EditProductMediaForm` at `apps/admin/src/features/products/components/edit-product-media-form.tsx`
- [ ] Two-pane layout: left pane (image grid with reorder), right pane (`UploadMediaFormItem`)
- [ ] Left pane uses `@dnd-kit/core` + `@dnd-kit/sortable` for drag-to-reorder
- [ ] Each image has selection checkbox, `CommandBar` with "Make thumbnail" and "Delete"
- [ ] Form state: `media` field array with `{ id?: string, url: string, isThumbnail: boolean, file: File | null }`
- [ ] Submit flow: upload new files (where `file` is non-null) → replace blob URLs with storage URLs → extract thumbnail → call `useUpdateProduct` with `{ images, thumbnail }`
- [ ] `ProductCreateMediaSection` at `apps/admin/src/features/products/components/create-product-form/product-create-details-media-section.tsx`
- [ ] Added to the "Details" tab of the multi-step product create form
- [ ] Shows `UploadMediaFormItem` + staged image list with "Make thumbnail", "Delete", drag-to-reorder
- [ ] On product create submit: upload all files → map URLs into `images` + `thumbnail` → include in `createProduct` payload
- [ ] `@dnd-kit/core` and `@dnd-kit/sortable` dependencies added
- [ ] Full round-trip works: drop image → upload → see on product → reorder → set thumbnail → delete
