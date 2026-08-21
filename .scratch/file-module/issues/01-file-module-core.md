# 01 — File module core: types, abstract provider, module definition

**What to build:** A fully wired file module that can be resolved via `Modules.FILE` from the shared container. Register a fixture (in-memory) provider, call `fileService.createFiles()` to store a file, `retrieveFile()` to get its URL back, `deleteFiles()` to remove it, and `getUploadFileUrls()` for presigned URLs. The module enforces exactly one provider at boot. All public service methods (`createFiles`, `deleteFiles`, `retrieveFile`, `listFiles`, `listAndCountFiles`, `getUploadFileUrls`, `getProvider`, `getDownloadStream`, `getAsBuffer`, `getUploadStream`) are callable through the `IFileModuleService` interface. The `maxFileSize` config (default 10MB) rejects oversized uploads at the service level before delegating to the provider.

This ticket covers: file types in `core/types/file/`, `AbstractFileProviderService` in `core/utils/`, `FileProviderService` (single-provider constraint), `FileModuleService`, provider loader following the payment module's pattern, `fileProviderDeclarations` with a placeholder local entry, `FILE: 'file'` in `Modules` enum, and bootstrap in `container.ts`. Integration tests use an in-memory fixture provider.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `core/types/file/` types exist: `FileDTO`, `FilterableFileProps`, `UploadFileUrlDTO`, `CreateFileDTO`, `GetUploadFileUrlDTO`, provider types (`ProviderUploadFileDTO`, `ProviderFileResultDTO`, `ProviderDeleteFileDTO`, `ProviderGetFileDTO`, `ProviderGetPresignedUploadUrlDTO`, `ProviderUploadStreamDTO`, `IFileProvider`), `IFileModuleService`
- [ ] `AbstractFileProviderService` in `core/utils/` with default-throw implementations for the 6 required methods (not the optional `getPresignedUploadUrl`)
- [ ] `FileProviderService` scans the container for keys starting with `fs_` prefix, enforces exactly one provider
- [ ] `FileModuleService` implements `IFileModuleService`, delegates to `FileProviderService`
- [ ] `FileModuleService.createFiles` checks `Buffer.byteLength(content, 'base64')` against `maxFileSize` config before delegating
- [ ] Provider loader follows payment module pattern: `loadFileProviders({ container, options })`, registers as `fs_{identifier}_{configId}`
- [ ] `FileProviderRegistrationPrefix` constant shared between loader and `FileProviderService`
- [ ] `Modules.FILE = 'file'` added to modules definition
- [ ] Module bootstrapped in `container.ts` with `fileProviderDeclarations`
- [ ] Integration tests with in-memory fixture provider pass: create/retrieve, create multiple, delete, presigned URL generation, presigned URL rejection on empty filename, `listFiles` throws without `id` filter, `listAndCountFiles` returns correct count, `getProvider()` returns provider instance
