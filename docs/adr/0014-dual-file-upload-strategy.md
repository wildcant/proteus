# 14. Dual File Upload Strategy (Multipart + Presigned URLs)

**Status:** Accepted

## Context

The file module needs upload endpoints. Two approaches exist:

1. **Multipart upload** — client sends file bytes to the server, server forwards to storage provider
2. **Presigned URL** — server generates a signed URL, client uploads directly to the storage provider

Medusa v2 chose to keep both. Their codebase comment explains the multipart path:

> "For now we keep the files in memory, as that's how they get passed to the workflows. This will need revisiting once we are closer to prod-ready v2, since with workflows and potentially services on other machines using streams is not as simple as it used to be."

The core tension: **workflow engines need serializable data**. Streams can't be passed between steps that might run on different machines, but a base64 string can. Presigned URLs sidestep the problem entirely — the file never touches the server.

## Decision

Keep both upload paths:

- `POST /admin/uploads` — multipart form data, server-mediated. Files are read into memory, base64-encoded, and passed through the `uploadFilesWorkflow` to the provider's `upload()` method. Simple for small files and guaranteed to work with any provider.

- `POST /admin/uploads/presigned-urls` — JSON request/response. Server generates a unique filename (ULID + MIME subtype extension) and asks the provider for a presigned upload URL. Client then PUTs the file directly to storage. Better for large files, lower server load, but requires provider support.

## Trade-offs

| | Multipart | Presigned URL |
|---|---|---|
| File goes through server | Yes (base64) | No (direct to storage) |
| Works with workflows | Yes (serializable) | N/A (no workflow) |
| Large files | Limited by server RAM | Unlimited |
| Provider support | Universal | Optional |
| Client complexity | One request | Two-step |

## Notes

Our workflow engine currently runs in-process (not distributed), so the base64 serialization overhead is less costly than in Medusa's distributed architecture. If we move to distributed workflows, the presigned URL path becomes the preferred default for large files.
