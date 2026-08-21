# 06 — Admin fetcher FormData support + upload SDK layer

**What to build:** The admin app's API fetcher gains FormData support so multipart uploads work through the generated client. A `useUploadFiles()` mutation hook wraps the generated upload functions. Orval regeneration produces typed upload client functions.

**Blocked by:** 05 — Upload API routes and workflows

**Status:** ready-for-agent

- [ ] Admin fetcher (`src/lib/fetcher.ts`) detects `FormData`: skips `JSON.stringify`, omits `Content-Type` header (lets browser set multipart boundary)
- [ ] Orval regeneration produces `src/api/generated/uploads/uploads.ts` with `uploadFiles`, `getUploadedFile`, `deleteUploadedFile` functions
- [ ] `useUploadFiles()` mutation hook in `src/features/uploads/api/uploads.ts` wrapping the generated `uploadFiles()` with TanStack Query, error toast on failure
- [ ] Uploading a file via the admin UI's mutation hook successfully stores the file and returns `{ files: [{ id, url }] }`
