# 05 — Upload API routes + workflows

**What to build:** Four admin API endpoints for file management, backed by workflows with compensation. An admin user can upload a file via multipart `POST /admin/uploads`, retrieve its download URL via `GET /admin/uploads/:id`, delete it via `DELETE /admin/uploads/:id`, and get a presigned upload URL via `POST /admin/uploads/presigned-urls`. If a workflow step fails after upload, compensation automatically deletes the uploaded files.

**Blocked by:** 01 — File module core, 04 — Multipart and static file serving

**Status:** ready-for-agent

- [ ] `UPLOADS: 'Uploads'` added to the `Tags` enum
- [ ] HTTP schemas in `packages/http-schemas/src/admin/upload/`: `AdminFile` entity, `AdminUploadResponse`, `AdminFileResponse`, `AdminDeleteFileResponse`
- [ ] `POST /admin/uploads` — receives `multipart/form-data` via `HttpRequest.files`, maps each `File` to `{ filename, mimeType, content: base64, access: "public" }`, runs `uploadFilesWorkflow`, returns `{ files: FileDTO[] }`
- [ ] `GET /admin/uploads/:id` — resolves file module, calls `retrieveFile(id)`, returns `{ file: FileDTO }`
- [ ] `DELETE /admin/uploads/:id` — runs `deleteFilesWorkflow`, returns `{ id, object: "file", deleted: true }`
- [ ] `POST /admin/uploads/presigned-urls` — validates body (`originalname`, `mime_type`, `size`, optional `access`), generates unique filename using `ulid()` + `MIMEType` subtype extension, calls `getUploadFileUrls`, returns `{ url, filename, mime_type, size, extension, originalname }`
- [ ] `uploadFilesWorkflow` — single step wrapping `createFiles()`, compensation calls `deleteFiles(createdIds)`
- [ ] `deleteFilesWorkflow` — single step wrapping `deleteFiles(ids)`, no compensation
- [ ] `ulid` dependency added
- [ ] Route definitions registered with authentication middleware
- [ ] Testable end-to-end with the local provider: upload a file via multipart, retrieve its URL, delete it
