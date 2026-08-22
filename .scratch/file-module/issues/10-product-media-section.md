# 10 — ProductMediaSection on product detail page

**What to build:** An image grid on the product detail page showing the product's images. Each image has a hover-reveal selection checkbox. When images are selected, a `CommandBar` appears with a "Delete" action that calls `useUpdateProduct` with the remaining images (triggering collection replacement on the backend). An "Edit Media" action in the section header links to the media edit route.

**Blocked by:** 07 — Inline product image handling, 09 — FileUpload component + UploadMediaFormItem

**Status:** ready-for-agent

- [ ] `ProductMediaSection` component at `apps/admin/src/features/products/components/product-media-section.tsx`
- [ ] Renders a grid of image thumbnails (`auto-fill, minmax(96px, 1fr)`)
- [ ] Each cell shows the image with a hover-reveal checkbox for selection
- [ ] Clicking an image opens the media edit modal (links to `/products/:id/media`)
- [ ] "Edit Media" action in section header links to `/products/:id/media`
- [ ] When images are selected, `CommandBar` appears with "Delete" action
- [ ] Delete calls `useUpdateProduct` with the remaining images array (collection replacement)
- [ ] Section rendered on the product detail page layout
- [ ] Images displayed are fetched from `GET /admin/products/:id` response
