# 09 — FileUpload component + UploadMediaFormItem

**What to build:** A reusable drag-and-drop file upload component and a product-specific form wrapper. Dropping or selecting image files generates blob preview URLs and validates file size. The form wrapper connects to TanStack Form's field array, validates MIME types against an allow-list, and stages files locally without uploading — actual upload happens on form submission.

**Blocked by:** 06 — Admin fetcher FormData support + upload SDK layer

**Status:** ready-for-agent

- [ ] `FileUpload` component at `apps/admin/src/components/common/file-upload/file-upload.tsx`
- [ ] Props: `formats: string[]` (MIME types), `maxFileSize?: number` (bytes, default 1MB), `onUploaded` callback
- [ ] Renders a `<button>` as drag-drop target with hidden `<input type="file" multiple>`
- [ ] On drop/select: validates file size, generates random ID and blob URL via `URL.createObjectURL(file)`
- [ ] Returns `FileType: { id: string, url: string, file: File }` for valid files, `RejectedFile: { file: File, reason: "size" }` for oversized
- [ ] `UploadMediaFormItem` at `apps/admin/src/features/products/components/upload-media-form-item.tsx`
- [ ] Wraps `FileUpload` inside a TanStack Form field, receives `form` and `append` props
- [ ] Hardcoded MIME allow-list: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/heic`, `image/svg+xml`
- [ ] Sets form errors for invalid MIME types or oversized files
- [ ] Appends valid files as `{ id, url: blobUrl, file: File, isThumbnail: false }` to the `media` field array
- [ ] No network calls — files stay as local `File` objects until form submission
