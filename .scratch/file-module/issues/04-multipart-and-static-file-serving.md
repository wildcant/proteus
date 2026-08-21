# 04 — Multipart upload support in adapters + static file serving

**What to build:** Both HTTP adapters (Express and Hono) gain the ability to parse `multipart/form-data` requests and serve static files. After this ticket, a `POST` with `Content-Type: multipart/form-data` populates `HttpRequest.files` with Web standard `File` objects, and files placed in `{cwd}/static/` are accessible at `/static/*`. Existing JSON body parsing continues to work unchanged.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `HttpRequest` type in `server/ports.ts` gains `files?: File[]` field
- [ ] **Express adapter:** `express.json()` changed to `express.json({ type: 'application/json' })` so it doesn't consume the body stream for multipart requests
- [ ] **Express adapter:** For multipart requests, constructs a Web `Request` from Express's `req` and calls `.formData()` to extract `File` entries into `HttpRequest.files`
- [ ] **Hono adapter:** Content-type check before body parsing — if `multipart/form-data`, calls `c.req.raw.formData()` and extracts `File` entries; otherwise falls through to `c.req.json()`
- [ ] For multipart requests: `files` is populated, `body` is `undefined`. For JSON requests: `body` is populated, `files` is `undefined`
- [ ] **Express:** `app.use('/static', express.static(path.join(process.cwd(), 'static')))` serves static files
- [ ] **Hono:** `app.use('/static/*', serveStatic())` using `serveStatic` from `hono/cloudflare-workers`
- [ ] Existing JSON body parsing is unaffected (all existing tests still pass)
