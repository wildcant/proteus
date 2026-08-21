# 02 — Local filesystem provider

**What to build:** A `localfs` file provider that stores files on the local filesystem at `{cwd}/static/`. Upload a file via the file module service, find it on disk at `static/{timestamp}-{filename}`, access it via its URL (`http://localhost:9000/static/{key}`), delete it, and verify the file is gone from disk. Private files get a `private-` key prefix. Path traversal attempts (e.g., `../../etc/passwd`) are rejected.

The provider implements all 6 required `IFileProvider` methods plus the optional `getPresignedUploadUrl` (returns `{ url: "/admin/uploads", key: filename }`). Content decoding tries base64 first, falls back to UTF-8 for text MIME types, binary for everything else.

**Blocked by:** 01 — File module core

**Status:** ready-for-agent

- [ ] Provider identifier: `localfs`, registered as `fs_localfs_local`
- [ ] Config options with defaults: `upload_dir` (default `{cwd}/static/`), `private_upload_dir` (default same as `upload_dir`), `backend_url` (default `http://localhost:9000/static`)
- [ ] Uploads write to disk with key `{timestamp}-{filename}`
- [ ] Private files get `private-` prefix in key
- [ ] `decodeFileContent` handles base64, UTF-8 text (`text/*`, `csv`, `json`, `xml`), and binary
- [ ] Path traversal protection via `path.relative` check — rejects keys that escape the upload directory
- [ ] Delete silently succeeds if file doesn't exist (ENOENT swallowed)
- [ ] `getPresignedDownloadUrl` throws for non-existent files
- [ ] `getPresignedUploadUrl` returns `{ url: "/admin/uploads", key: filename }`
- [ ] Provider-level tests pass: upload + read back, delete (including non-existent), path traversal rejection, content decoding for all three modes, private file prefix
