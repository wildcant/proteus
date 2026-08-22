# 03 — S3-compatible provider

**What to build:** An `s3` file provider using `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` that works with both AWS S3 and Cloudflare R2 (same SDK, different endpoint/region config). Implements all 6 required `IFileProvider` methods plus `getPresignedUploadUrl`. Explicit credentials required in config — no auto-discovery chain (Workers can't use it).

**Blocked by:** 01 — File module core

**Status:** ready-for-agent

- [ ] Provider identifier: `s3`, registered as `fs_s3_default`
- [ ] Config: `file_url`, `region`, `bucket`, `access_key_id`, `secret_access_key`, optional `prefix`, optional `endpoint` (required for R2)
- [ ] Upload handles base64 content decoding, sets ACL based on `access` (public-read vs private)
- [ ] Delete handles single and batch file deletion
- [ ] `getPresignedDownloadUrl` generates a signed URL for private files
- [ ] `getPresignedUploadUrl` generates a signed PUT URL for direct client-side upload
- [ ] URL encoding handles file keys with special characters
- [ ] R2 compatibility: works with `region: "auto"` and custom `endpoint`
- [ ] Dependencies added: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
- [ ] Provider-level tests pass (mocked SDK): ACL handling, binary content round-trip, URL encoding of special characters, presigned URL generation (upload and download)
