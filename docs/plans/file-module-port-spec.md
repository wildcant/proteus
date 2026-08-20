# File Module Port Spec

## Problem Statement

The platform has no file management system. There is no way to upload product images, import CSVs, or store any binary content. Without a file module, features that depend on file storage (product media, bulk imports, document attachments) cannot be built. The platform needs a file module that works in both the Node.js (Express) and Cloudflare Workers (Hono) runtimes, and can talk to local disk during development and S3/R2 in production.

## Solution

Port Medusa's file module to Proteus as a provider-based infrastructure module. The module delegates all storage operations (upload, delete, download, streaming) to exactly one registered `IFileProvider`. It has no database model -- the provider's storage key IS the file's ID. Two providers ship: a local filesystem provider for development and an S3-compatible provider that works with both AWS S3 and Cloudflare R2.

Multipart file upload support is added to both HTTP adapters (Express and Hono) using the Web standard `Request.formData()` API, keeping route handlers runtime-agnostic.

## User Stories

1. As a developer, I want a file module registered in the container, so that I can resolve `Modules.FILE` and call file operations from any service or workflow.
2. As a developer, I want to upload a file via `fileService.createFiles({ filename, mimeType, content })`, so that I can store binary content and receive back an `{ id, url }`.
3. As a developer, I want to delete a file by its ID via `fileService.deleteFiles(id)`, so that I can remove stored content.
4. As a developer, I want to retrieve a file's download URL via `fileService.retrieveFile(id)`, so that I can serve it to clients.
5. As a developer, I want to list files by ID via `fileService.listFiles({ id })`, so that I can look up multiple files at once.
6. As a developer, I want to list and count files via `fileService.listAndCountFiles({ id })`, so that I can paginate file results.
7. As a developer, I want to get a presigned upload URL via `fileService.getUploadFileUrls({ filename })`, so that clients can upload directly to the storage backend without proxying through the server.
8. As a developer, I want to access the raw provider via `fileService.getProvider()`, so that I can call provider-specific methods when needed.
9. As a developer, I want to stream a file's contents via `fileService.getDownloadStream(id)`, so that I can process large files without buffering the entire content in memory.
10. As a developer, I want to read a file as a Buffer via `fileService.getAsBuffer(id)`, so that I can process file content in memory when appropriate.
11. As a developer, I want to get a writable stream via `fileService.getUploadStream({ filename, mimeType })`, so that I can pipe data to storage without buffering.
12. As a developer, I want to swap the file provider by changing config, so that I use local disk in development and S3/R2 in production without code changes.
13. As a developer, I want file uploads to work identically in both Node.js and Cloudflare Workers runtimes, so that I don't maintain runtime-specific upload code.
14. As an admin user, I want to upload files via `POST /admin/uploads` with multipart form data, so that I can add product images or import CSVs from the dashboard.
15. As an admin user, I want to retrieve a file via `GET /admin/uploads/:id`, so that I can get its download URL.
16. As an admin user, I want to delete a file via `DELETE /admin/uploads/:id`, so that I can remove uploaded content.
17. As an admin user, I want to get a presigned upload URL via `POST /admin/uploads/presigned-urls`, so that the client can upload directly to S3/R2 without proxying through the server.
18. As a developer, I want the upload workflow to have compensation, so that if a downstream step fails, the uploaded files are automatically deleted.
19. As a developer, I want to write a custom file provider by extending `AbstractFileProviderService`, so that I can integrate with any storage backend.
20. As a developer, I want the S3 provider to work with Cloudflare R2 by changing the endpoint and region config, so that I don't need a separate R2 provider.
21. As an admin user, I want to upload images on the product detail page, so that I can add media to showcase the product in the storefront.
22. As an admin user, I want to drag-and-drop reorder product images, so that I can control the display order.
23. As an admin user, I want to set a product image as the thumbnail, so that I can control which image represents the product in listings.
24. As an admin user, I want to delete product images, so that I can remove outdated or incorrect media.
25. As an admin user, I want to add images during product creation, so that I can set up media before publishing.
26. As an admin user, I want to see product images on the product detail page, so that I can review the current media.
27. As a developer, I want the product update endpoint to accept an `images` array, so that the admin can manage product media via the API.
28. As a developer, I want `setProductImages()` to handle collection replacement (create/keep/delete by comparing the input array to existing images), so that the admin only needs to send the desired final state.
29. As a developer, I want the product's thumbnail to auto-set to the first image URL when no thumbnail is explicitly provided, so that products always have a representative image.

## Implementation Decisions

### Module architecture

- **No database table.** The module has no models, no repositories, no migrations. The file's `id` is the provider's storage key (e.g., `1724167200000-photo.jpg` for local, an S3 object key for S3). The `FileDTO` is `{ id: string, url: string }`. Since Proteus's `Module()` requires a `repositories` field, pass `repositories: {}` (empty object) in the module definition.
- **Single provider constraint.** The module enforces exactly one file provider at boot time. If zero or more than one provider is registered, the module throws. Provider selection is a config-time decision, not a runtime decision.
- **Provider registration key format:** `fs_{identifier}_{configId}` (e.g., `fs_localfs_local`, `fs_s3_default`). Follows the Medusa convention exactly.
- **Module key:** Add `FILE: 'file'` to the `Modules` enum in `modules-definition.ts`.

### Provider interface

The `IFileProvider` interface has 6 required methods and 1 optional method, identical to Medusa's:

**Required (6):**
- `upload(file: ProviderUploadFileDTO): Promise<ProviderFileResultDTO>` -- upload via base64 content string
- `delete(files: ProviderDeleteFileDTO | ProviderDeleteFileDTO[]): Promise<void>` -- delete one or more files
- `getPresignedDownloadUrl(fileData: ProviderGetFileDTO): Promise<string>` -- get a download URL
- `getDownloadStream(fileData: ProviderGetFileDTO): Promise<Readable>` -- stream file contents
- `getAsBuffer(fileData: ProviderGetFileDTO): Promise<Buffer>` -- get file as Buffer
- `getUploadStream(fileData: ProviderUploadStreamDTO): Promise<{ writeStream: Writable, promise: Promise<ProviderFileResultDTO>, url: string, fileKey: string }>` -- get a writable stream

**Optional (1):**
- `getPresignedUploadUrl?(fileData: ProviderGetPresignedUploadUrlDTO): Promise<ProviderFileResultDTO>` -- get a presigned URL for client-side direct upload. Note the `?` -- providers that don't support presigned uploads omit this method entirely.

`Readable` and `Writable` are Node.js stream types. In Cloudflare Workers with `nodejs_compat`, these are available via the compatibility layer. Both the local and S3 providers use these types.

### Abstract base class

`AbstractFileProviderService` goes in `core/utils/abstract-file-provider.ts`. Contains default-throw implementations for the 6 required methods only. The optional `getPresignedUploadUrl` is NOT declared on the abstract class -- providers that support it add it themselves. No `validateOptions` (providers validate in their constructor). No `getIdentifier` (unused). Providers must set `static identifier: string`.

### Content encoding

File content passes through the stack as a base64-encoded string (`ProviderUploadFileDTO.content` is `string`), matching Medusa's interface. The route handler converts `File.arrayBuffer()` to base64. Providers decode base64 back to binary before writing to storage.

### Service layers

Three layers, matching Medusa:

1. **`FileModuleService`** -- public API implementing `IFileModuleService`. Delegates to `FileProviderService`. Methods: `createFiles` (array/single overloads), `deleteFiles` (array/single), `retrieveFile`, `listFiles` (requires `id` filter, throws otherwise), `listAndCountFiles` (same `id` filter requirement), `getUploadFileUrls` (array/single), `getProvider` (returns the raw `FileProviderService`), `getDownloadStream`, `getAsBuffer`, `getUploadStream`. `IFileModuleService` is a standalone interface -- it does NOT extend Medusa's `IModuleService` (Proteus has no such base interface).
2. **`FileProviderService`** -- enforces single-provider constraint. Receives the Awilix container directly (not the cradle proxy) so it can scan registered keys. Filters for keys starting with the `FileProviderRegistrationPrefix` constant (`"fs_"`). This constant is defined in `modules/file/types/index.ts` and imported by both the loader and `FileProviderService`. Validates presigned URL requests (provider must implement the method, filename must be non-empty).
3. **Provider instance** -- the actual storage implementation (local or S3).

### Provider loader

`loadFileProviders` follows the payment module's loader pattern (which uses `pp_{identifier}_{id}`). For each configured provider, instantiates the service class with `new Klass(container.cradle, config.options ?? {})` and registers as `fs_{identifier}_{configId}`. Then instantiates `FileProviderService`, passing the container itself (not the cradle), and registers it in the local container.

### Provider declarations and container wiring

A `provider-declarations.ts` file in the file module exports the `fileProviderDeclarations` constant -- an array of `{ resolve: ModuleProviderExports, id: string, options: {} }` entries. This follows the same pattern as `authProviderDeclarations` and `paymentProviderDeclarations`.

In `container.ts`, the module is bootstrapped with its provider config:

```
import fileModule from './modules/file/index.js'
import { fileProviderDeclarations } from './modules/file/provider-declarations.js'

await bootstrapModule(container, fileModule, { providers: fileProviderDeclarations })
```

### Local filesystem provider (`localfs`)

- Identifier: `localfs`
- Writes files to `{cwd}/static/` with keys like `{timestamp}-{filename}`. Private files get a `private-` prefix.
- Config options with defaults:
  - `upload_dir` -- defaults to `path.join(process.cwd(), "static")`
  - `private_upload_dir` -- defaults to same as `upload_dir` (both public and private files in the same directory -- dev-only, see Further Notes)
  - `backend_url` -- defaults to `"http://localhost:9000/static"`. Must match the Proteus server's actual host and port.
- Content decoding: tries base64 first, falls back to UTF-8 for text MIME types (`text/*`, `csv`, `json`, `xml`), binary for everything else (same `decodeFileContent` logic as Medusa).
- Path traversal protection via `path.relative` check.
- `getPresignedUploadUrl` returns `{ url: "/admin/uploads", key: filename }`.
- Delete silently succeeds if file doesn't exist (`ENOENT` is swallowed).

### S3-compatible provider (`s3`)

- Identifier: `s3`
- Uses `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`. Works with both AWS S3 and Cloudflare R2 (same SDK, different endpoint/region).
- **Explicit credentials required** in provider config -- no auto-discovery chain (Workers can't use it):
  - `file_url: string` -- base URL for public file access
  - `prefix?: string` -- key prefix
  - `region: string` -- `"us-east-1"` for S3, `"auto"` for R2
  - `bucket: string`
  - `endpoint?: string` -- required for R2, optional for S3
  - `access_key_id: string`
  - `secret_access_key: string`

### Multipart upload handling

Both HTTP adapters are extended to parse `multipart/form-data` using the Web standard `Request.formData()` API:

- **Hono adapter:** Check `Content-Type` header before body parsing. If `multipart/form-data`, call `c.req.raw.formData()` (native in workerd) and extract `File` entries. Otherwise, fall through to the existing `c.req.json()` path. This replaces the current unconditional `c.req.json().catch(() => undefined)` with a content-type branch.
- **Express adapter:** The global `express.json()` middleware consumes the body stream, which prevents later `formData()` parsing. Fix: make `express.json()` conditional -- skip it when `Content-Type` is `multipart/form-data`. Then, for multipart requests, construct a Web `Request` from Express's `req` (passing headers and the unconsumed body stream) and call `.formData()`. Node 18+ supports this via the built-in `undici` global `Request`.
- Parsed `File` objects (Web standard type) are placed on `HttpRequest.files?: File[]`. Add the `files` field to the `HttpRequest` type in `server/ports.ts`. Route handlers receive `File` objects regardless of runtime.
- For multipart requests: `files` is populated, `body` is `undefined`. For JSON requests: `body` is populated, `files` is `undefined`. The two are mutually exclusive based on content type.

### Static file serving

Both adapters serve static files for the local provider. The URL path `/static/*` maps to the filesystem directory `{cwd}/static/` (the local provider's default `upload_dir`):

- **Express:** `app.use('/static', express.static(path.join(process.cwd(), 'static')))`
- **Hono:** `app.use('/static/*', serveStatic())` using `serveStatic` from `hono/cloudflare-workers`

### API routes

Four routes under `/admin/uploads`:

- `POST /admin/uploads` -- receives `multipart/form-data` via `HttpRequest.files`. Maps each `File` to `{ filename, mimeType, content: buffer.toString("base64"), access: "public" }`. The `access: "public"` is hardcoded for all multipart uploads (matching Medusa). Runs `uploadFilesWorkflow`. Returns `{ files: FileDTO[] }`.
- `GET /admin/uploads/:id` -- resolves file module, calls `retrieveFile(id)` directly (Medusa uses `remoteQuery` for this, but Proteus has no joiner infrastructure, so we call the service directly). Returns `{ file: FileDTO }`.
- `DELETE /admin/uploads/:id` -- runs `deleteFilesWorkflow`. Returns `{ id, object: "file", deleted: true }`.
- `POST /admin/uploads/presigned-urls` -- request body schema:
  ```
  { originalname: string, mime_type: string, size: number, access?: "public" | "private" }
  ```
  `access` defaults to `"private"` when not provided. Resolves file module, generates unique filename using `ulid()` + MIME subtype extension (via Node's `MIMEType` class -- note that `image/svg+xml` yields subtype `"svg+xml"`, not `"svg"`). Calls `getUploadFileUrls({ filename, mimeType, access })`. Returns `{ url, filename, mime_type, size, extension, originalname }`.

### Workflows

- **`uploadFilesWorkflow`** -- single step wrapping `fileService.createFiles()`. Compensation calls `fileService.deleteFiles(createdIds)` to roll back uploads on workflow failure.
- **`deleteFilesWorkflow`** -- single step wrapping `fileService.deleteFiles(ids)`. No compensation (deletions are irreversible).

### Dependencies to add

- `ulid` -- for presigned URL filename generation
- `@aws-sdk/client-s3` -- S3/R2 client
- `@aws-sdk/s3-request-presigner` -- presigned URL generation

### Types

All types go in `core/types/file/`:

- `common.ts` -- `FileAccessPermission`, `FileDTO`, `FilterableFileProps`, `UploadFileUrlDTO`
- `mutations.ts` -- `CreateFileDTO`, `GetUploadFileUrlDTO`
- `provider.ts` -- `ProviderUploadFileDTO`, `ProviderFileResultDTO`, `ProviderDeleteFileDTO`, `ProviderGetFileDTO`, `ProviderGetPresignedUploadUrlDTO`, `ProviderUploadStreamDTO`, `IFileProvider`
- `service.ts` -- `IFileModuleService` (standalone interface, does NOT extend `IModuleService`)

Types match Medusa's definitions with two clarifications:
- `FilterableFileProps.id` is typed as `string | string[] | undefined` (Medusa's type says `string | undefined` but the service handles arrays at runtime -- we fix the type to match reality).
- `IFileModuleService` includes `getProvider(): IFileProvider` and `listAndCountFiles()` which are present in Medusa but were missing from the initial draft.

Internal module types go in `modules/file/types/index.ts`:
- `FileProviderRegistrationPrefix = "fs_"` -- shared constant imported by both the loader and `FileProviderService`
- `FileProviderIdentifierRegistrationName = "file_providers_identifier"` -- registry key for provider identifiers

## Testing Decisions

### What makes a good test

Tests should exercise external behavior through the module's public interface (`IFileModuleService`), not internal implementation details. A test should not depend on which provider is registered, how content is encoded internally, or how the container wires things up. Tests use the in-memory fixture provider to isolate the module from real storage backends.

### Testing seams

1. **Module service seam** (`IFileModuleService`) -- the highest seam. Integration tests create the module with a fixture provider and exercise all service methods through the public interface.
2. **Provider seam** (`IFileProvider`) -- each provider is tested independently. Provider-specific behavior (path traversal protection, content decoding, S3 presigning) lives here.

### Module integration tests

Use an in-memory fixture provider (plain JS object as storage). Test cases matching Medusa:

- Creates a file and retrieves it by ID
- Creates multiple files in a single call
- Deletes a file by ID
- Generates a presigned upload URL
- Rejects presigned upload URL when filename is empty
- `listFiles` throws when called without an `id` filter
- `listAndCountFiles` returns correct count
- `getProvider()` returns the provider service instance

The fixture provider only implements the methods that tests exercise (`upload`, `delete`, `getPresignedDownloadUrl`, `getPresignedUploadUrl`). The streaming methods (`getDownloadStream`, `getAsBuffer`, `getUploadStream`) are left as default throws from the abstract class since no integration test calls them.

### Provider tests -- local

- Uploads a file and reads it back from disk
- Deletes a file (succeeds even if file doesn't exist)
- Rejects path traversal attempts in file keys
- `decodeFileContent` correctly handles base64, UTF-8 text, and binary content
- Private files get `private-` prefix in key
- `getPresignedDownloadUrl` throws for non-existent files

### Provider tests -- S3

- ACL handling (public vs private access)
- Binary content encoding (base64 round-trip)
- URL encoding of file keys with special characters
- Presigned URL generation (upload and download)

These match Medusa's existing test files for each provider.

## Validation Scope: Product Images Admin CRUD

The file module is validated end-to-end by building product image management into the admin. This exercises multipart upload, file storage, URL-based decoupling between the file and product modules, and the full round-trip from the admin UI to storage and back.

### Current State in Proteus

The product module already has the data layer for images:
- **`product_image` table** exists (Drizzle schema) with `id` (prefix `img_`), `productId` FK (cascade delete), `url`, `rank`, `metadata`, and timestamps.
- **`ProductImageRepository`** extends `BaseRepository(productImageTable)`.
- **`ProductModuleService`** has `createProductImages()` and `createProductImage()` methods.
- **`IProductModuleService`** declares both image creation methods.
- **`ProductImageDTO`**, `CreateProductImageDTO`, `UpdateProductImageDTO`, `FilterableProductImageProps` types all exist.

What does NOT exist yet:
- No image list/delete/update methods on the product service.
- No `images` field on `AdminProduct` entity schema or API responses.
- No `images` or `thumbnail` fields on `AdminCreateProduct` / `AdminUpdateProduct` payloads.
- No product image API routes.
- No upload API routes or generated client.
- No admin UI components for file upload, media display, or image management.

### Backend Changes

#### 1. Product module service — new image methods

Add to `IProductModuleService` and `ProductModuleService`:

- `listProductImages(filters: FilterableProductImageProps, config?, context?): Promise<ProductImageDTO[]>` — list images, primarily by `productId`.
- `deleteProductImages(imageIds: string[], context?): Promise<void>` — soft-delete images by ID.
- `updateProductImage(imageId: string, data: UpdateProductImageDTO, context?): Promise<ProductImageDTO>` — update rank or metadata.
- `setProductImages(productId: string, images: Array<{ id?: string, url: string }>, context?): Promise<ProductImageDTO[]>` — the collection-replacement method. Receives the full desired image array. Images with an `id` matching an existing record are kept (rank updated to array index). Images without an `id` are created. Existing images absent from the input array are soft-deleted. Auto-sets `product.thumbnail` to `images[0].url` if no thumbnail is provided (matching Medusa's normalization). This is the method the product update route calls.

#### 2. HTTP schemas — extend product types

**`AdminProductImage` entity** (new file `packages/http-schemas/src/admin/product/entities.ts` or colocated):
```
z.object({ id: z.string(), url: z.string(), rank: z.number() })
```

**`AdminProduct` entity** — add:
- `images: z.array(AdminProductImage).optional()` — included when product is fetched with images.

**`AdminCreateProduct` payload** — add:
- `images: z.array(z.object({ url: z.string() })).optional()`
- `thumbnail: z.string().nullable().optional()`

**`AdminUpdateProduct` payload** — expand from title-only to full update (it's currently just `{ title: z.string().min(1) }`):
- All current `AdminCreateProduct` fields made optional.
- `images: z.array(z.object({ id: z.string().optional(), url: z.string() })).optional()` — on update, each image can optionally include its existing `id` to preserve it.
- `thumbnail: z.string().nullable().optional()`

**`AdminProductResponse`** — include `images` in the response shape alongside `options`.

#### 3. Upload API routes

These are defined in the file module port spec already (`POST /admin/uploads`, `GET /admin/uploads/:id`, `DELETE /admin/uploads/:id`, `POST /admin/uploads/presigned-urls`). Add `UPLOADS: 'Uploads'` to the `Tags` enum.

**Upload route definitions** (`api/admin/uploads/definitions.ts`):
- `POST /admin/uploads` — multipart, maps `HttpRequest.files` to base64, runs `uploadFilesWorkflow`, returns `{ files: FileDTO[] }`.
- `GET /admin/uploads/:id` — resolves file module, returns `{ file: FileDTO }`.
- `DELETE /admin/uploads/:id` — runs `deleteFilesWorkflow`, returns `{ id, deleted: true }`.

**HTTP schemas for uploads** (`packages/http-schemas/src/admin/upload/`):
- `AdminFile` entity: `z.object({ id: z.string(), url: z.string() })`
- `AdminUploadResponse`: `z.object({ files: z.array(AdminFile) })`
- `AdminFileResponse`: `z.object({ file: AdminFile })`
- `AdminDeleteFileResponse`: `DeleteResponse`

#### 4. Product routes — wire images

**`GET /admin/products/:id`** — after retrieving the product, also fetch `listProductImages({ productId: id }, { order: { rank: 'ASC' } })` and include `images` in the response.

**`GET /admin/products`** — include `images` in each product response (batch query by product IDs from the list result).

**`POST /admin/products`** — accept `images` and `thumbnail` in the body. After creating the product, if `images` is provided, call `createProductImages()` with each image's URL and its array index as `rank`. If `thumbnail` is not provided but `images[0]` exists, auto-set `thumbnail` to `images[0].url`.

**`PATCH /admin/products/:id`** — accept `images` and `thumbnail` in the body. If `images` is provided, call `setProductImages()` which handles the collection replacement (create new, keep existing, delete removed, update ranks). If `thumbnail` is explicitly provided (including `null`), update it.

#### 5. Orval regeneration

After adding the upload and updated product schemas, run `orval` to regenerate the admin API client. This produces:
- `src/api/generated/uploads/uploads.ts` — `uploadFiles`, `getUploadedFile`, `deleteUploadedFile` functions.
- Updated `src/api/generated/products/products.ts` — `createProduct` and `updateProduct` now accept `images` and `thumbnail`.
- Updated `src/api/generated/model/adminProduct.ts` — includes `images` array.

### Admin UI Components

#### 1. `FileUpload` — primitive drag-and-drop zone

**Location:** `apps/admin/src/components/common/file-upload/file-upload.tsx`

A presentational component. No network calls. Props:
- `formats: string[]` — MIME types for `<input accept>`.
- `maxFileSize?: number` — bytes, default 1MB.
- `onUploaded: (files: FileType[], rejectedFiles?: RejectedFile[]) => void`

Behavior:
- Renders a `<button>` as a drag-drop target with a hidden `<input type="file" multiple>`.
- On drop/select: validates each file's size, generates a random ID and blob preview URL via `URL.createObjectURL(file)`.
- Returns `FileType: { id: string, url: string, file: File }` for valid files, `RejectedFile: { file: File, reason: "size" }` for oversized ones.
- Displays "Upload images" text with a download icon, plus "Drag and drop images here or click to upload" hint.

#### 2. `UploadMediaFormItem` — form-connected drop zone

**Location:** `apps/admin/src/features/products/components/upload-media-form-item.tsx`

Wraps `FileUpload` inside a TanStack Form field. Props:
- `form` — the parent form instance.
- `append` — from the field array, to add new media entries.

Behavior:
- Hardcodes supported MIME types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/heic`, `image/svg+xml`.
- On upload: validates file types against the allow-list, sets form errors for invalid files or oversized files.
- Appends each valid file as `{ id, url: blobUrl, file: File, isThumbnail: false }` to the `media` field array.
- No upload happens here — files stay as local `File` objects until form submission.

#### 3. Upload SDK layer

**Location:** `apps/admin/src/features/uploads/api/uploads.ts`

TanStack Query wrapper around the generated upload functions:
- `useUploadFiles()` — mutation wrapping the generated `uploadFiles()`. The fetcher needs a special case for `FormData` bodies (currently it always does `JSON.stringify`). Either:
  - (a) Extend the fetcher to detect `FormData` and skip `JSON.stringify` + omit `Content-Type` (letting the browser set the multipart boundary), or
  - (b) Write a one-off `uploadFiles` function that calls `fetch` directly with `FormData`.

  Option (a) is cleaner since it keeps the fetcher as the single HTTP layer. Add a check: if `body instanceof FormData`, don't stringify and don't set `Content-Type`.

#### 4. `ProductMediaSection` — product detail page widget

**Location:** `apps/admin/src/features/products/components/product-media-section.tsx`

Rendered in the product detail layout's side column (or as a full-width section). Shows:
- A grid of image thumbnails (`auto-fill, minmax(96px, 1fr)`).
- Each cell shows the image with a hover-reveal checkbox for selection.
- Clicking an image opens the media edit modal.
- An "Edit Media" action in the section header links to the media edit route.
- When images are selected, a `CommandBar` appears with "Delete" action.
- Delete calls `useUpdateProduct` with the remaining images array (collection replacement).

#### 5. `EditProductMediaForm` — media management modal

**Location:** `apps/admin/src/features/products/components/edit-product-media-form.tsx`

Opened as a `RouteFocusModal` at route `/products/:id/media`. Two-pane layout:
- **Left pane:** Grid of current images with `@dnd-kit/core` for drag-to-reorder. Each image has a selection checkbox. `CommandBar` with "Make thumbnail" (sets `isThumbnail: true`) and "Delete" (removes from field array).
- **Right pane:** `UploadMediaFormItem` for adding new images.

**Form state:** A `media` field array where each entry is:
```ts
{ id?: string, url: string, isThumbnail: boolean, file: File | null }
```
- Existing images: `id` is the `ProductImage.id`, `url` is the storage URL, `file` is `null`.
- New images: `id` is absent, `url` is a local blob URL, `file` is the native `File` object.

**Submit flow:**
1. Identify entries where `file` is non-null (newly added).
2. Upload them via the upload mutation (sends `FormData` to `POST /admin/uploads`).
3. Replace blob URLs with the returned storage URLs.
4. Extract `thumbnail` as the URL of whichever entry has `isThumbnail: true`.
5. Call `useUpdateProduct` with `{ images: [...], thumbnail }` — this triggers the collection-replacement logic on the backend.

#### 6. `ProductCreateMediaSection` — media during product creation

**Location:** `apps/admin/src/features/products/components/create-product-form/product-create-details-media-section.tsx`

Added to the "Details" tab of the existing multi-step create form. Shows:
- `UploadMediaFormItem` for adding images.
- A list of staged images (only newly added files, since there are no existing ones yet).
- Each item has "Make thumbnail" and "Delete" actions.
- Drag-to-reorder for ordering.

**Submit flow on product create:**
1. Split `media` array into thumbnail vs non-thumbnail entries.
2. Upload all files via the upload mutation.
3. Map returned URLs into `images: [{ url }]` and `thumbnail: url` fields.
4. Include in the `createProduct` payload alongside other form fields.

#### 7. Route additions

Add to the admin router:
- `/products/:id/media` — renders `RouteFocusModal` with `EditProductMediaForm`. This is the route shown in the screenshot.

### Dependencies to add (admin)

- `@dnd-kit/core` — drag-and-drop for image reorder.

### Data Flow Summary

```
                              Admin UI
                              ────────
User drops images ──→ FileUpload (blob URLs, local File objects)
                              │
                   UploadMediaFormItem (field array, no upload)
                              │
                    On form submit
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
    POST /admin/uploads              POST or PATCH /admin/products/:id
    (FormData with files)            ({ images: [{ url }], thumbnail })
              │                               │
     uploadFilesWorkflow              setProductImages()
              │                        (collection replacement)
     File provider stores              │
     binary, returns URLs       product_image rows upserted
              │                 product.thumbnail updated
              ▼                               ▼
    { files: [{ id, url }] }        { product: { ...images } }
```

The URL string is the only bridge between the file module and the product module. There is no link table, no foreign key, no reference. The file module stores and serves binaries; the product module stores URLs as strings.

### What This Validates

| Concern | How it's exercised |
|---------|-------------------|
| Multipart upload in both runtimes | `POST /admin/uploads` with `FormData` tests the `Request.formData()` adapter |
| File provider storage | Upload → store → retrieve URL round-trip |
| Upload workflow compensation | If product creation fails after upload, files are cleaned up |
| URL-based decoupling | File module returns URL, product module stores it — no link table |
| Collection replacement | `setProductImages()` handles create/keep/delete/reorder in one call |
| Static file serving | Local provider: uploaded images served via `/static/*` path |
| Admin fetcher extension | `FormData` support in the fetcher (skip `JSON.stringify`) |
| Full user flow | Drop image → upload → see it on the product → reorder → set thumbnail → delete |

### Product images integration tests

- `setProductImages` creates new images, preserves existing ones by `id`, and soft-deletes removed ones.
- `setProductImages` assigns `rank` by array index.
- `setProductImages` auto-sets `product.thumbnail` to `images[0].url` when thumbnail is not provided.
- `listProductImages` returns images ordered by `rank` for a given `productId`.
- `deleteProductImages` soft-deletes images by ID.
- Product update endpoint (`PATCH /admin/products/:id`) with `images` payload triggers collection replacement.
- Product create endpoint (`POST /admin/products`) with `images` creates image rows and sets thumbnail.

## Out of Scope

- **MIME type validation** -- Medusa has a TODO for this; not implementing it in this port.
- **File metadata tracking in a database** -- no `file` table, no recording of size, uploader, timestamps. The `FileDTO` is `{ id, url }` only.
- **Multiple simultaneous providers** -- the module enforces exactly one provider.
- **R2 bindings** -- using the S3-compatible API only, not Cloudflare's native R2 Worker bindings.
- **Store (customer-facing) upload routes** -- only admin routes are in scope. Store routes can be added later.
- **`validateOptions` and `getIdentifier`** on the abstract class -- providers validate in their constructor.
- **Joiner config / `__joinerConfig()`** -- Medusa's `FileModuleService` implements this for the remote query system. Proteus has no joiner infrastructure, so this is omitted entirely.
- **Variant-image associations** -- Medusa has a `ProductVariantProductImage` pivot table and batch endpoints for linking specific images to specific variants (added in v2.11.2). This is out of scope for the initial port. All product images are product-level.
- **Image gallery / lightbox view** -- Medusa's admin has a full gallery lightbox with filmstrip navigation. The initial port only needs the grid view on the product detail page and the edit modal. A gallery view can be added later.
- **Presigned upload URLs route** -- defined in the file module spec but not wired into the admin UI for this validation. The admin uses direct multipart upload. The presigned URL endpoint exists for future client-side direct-to-S3 uploads.

## Further Notes

- The local provider is for **development only**. It has no real private file support -- `private_upload_dir` defaults to the same path as `upload_dir` (both `{cwd}/static/`). The `private-` prefix in the key is just a naming convention so deletions and presigned URLs can pick the right base directory.
- The S3 provider config shape requires **explicit credentials** (`access_key_id`, `secret_access_key`). This diverges from Medusa's S3 provider which can auto-discover credentials via the AWS SDK's credential chain. This is intentional -- the auto-discovery chain does not work in Cloudflare Workers.
- The base64 content encoding means the entire file sits in memory as a string (33% larger than raw binary) through every layer. For large files, use the streaming APIs (`getUploadStream`, `getDownloadStream`) instead of the base64 upload path.
- `ulid` is added as a new dependency for presigned URL filename generation. It produces time-sortable, URL-safe identifiers.
- The `File` type on `HttpRequest.files` is the Web standard `File` (a `Blob` subclass). Both Node.js 18+ and workerd support this natively.
- The `express.json()` bypass for multipart requests is the trickiest part of the adapter work. The cleanest approach: replace the global `app.use(express.json())` with a conditional middleware that checks `Content-Type` and only runs `express.json()` for non-multipart requests. This keeps the body stream unconsumed for multipart requests so `Request.formData()` can read it.
- `MIMEType.subtype` can produce compound extensions like `"svg+xml"` for `image/svg+xml`. The presigned URL route should handle this gracefully (e.g., mapping `"svg+xml"` to `"svg"` or accepting the compound form as-is -- Medusa uses it as-is).
