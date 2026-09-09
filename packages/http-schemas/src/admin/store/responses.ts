import { z } from 'zod'
import { AdminStore } from './entities.js'

export const AdminStoreResponse = z.object({ store: AdminStore }).openapi('AdminStoreResponse')
export type AdminStoreResponse = z.input<typeof AdminStoreResponse>
