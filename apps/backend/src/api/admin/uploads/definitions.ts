import type { RouteDefinition } from '@framework/http/types.js'
import { Tags } from '@framework/http/types.js'
import { AdminUploadFiles } from '@proteus/http-schemas/admin'
import * as uploadByIdRoutes from './[id]/route.js'
import * as presignedUrlRoutes from './presigned-urls/route.js'
import * as uploadRoutes from './route.js'

export default [
  {
    method: 'POST',
    matcher: '/admin/uploads',
    handler: uploadRoutes.POST,
    multipartBody: AdminUploadFiles,
    operationId: 'uploadFiles',
    summary: 'Upload files',
    tags: [Tags.UPLOADS],
    output: uploadRoutes.PostOutput,
  },
  {
    method: 'GET',
    matcher: '/admin/uploads/:id',
    handler: uploadByIdRoutes.GET,
    input: uploadByIdRoutes.GetInput,
    operationId: 'getUpload',
    summary: 'Retrieve a file',
    tags: [Tags.UPLOADS],
    output: uploadByIdRoutes.GetOutput,
  },
  {
    method: 'DELETE',
    matcher: '/admin/uploads/:id',
    handler: uploadByIdRoutes.DELETE,
    input: uploadByIdRoutes.DeleteInput,
    operationId: 'deleteUpload',
    summary: 'Delete a file',
    tags: [Tags.UPLOADS],
    output: uploadByIdRoutes.DeleteOutput,
  },
  {
    method: 'POST',
    matcher: '/admin/uploads/presigned-urls',
    handler: presignedUrlRoutes.POST,
    input: presignedUrlRoutes.PostInput,
    operationId: 'createPresignedUploadUrl',
    summary: 'Get a presigned upload URL',
    tags: [Tags.UPLOADS],
    output: presignedUrlRoutes.PostOutput,
  },
] satisfies RouteDefinition[]
