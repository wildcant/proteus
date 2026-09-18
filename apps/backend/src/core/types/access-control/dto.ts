import type { PermissionGrant, PermissionKey } from './common.js'

export type PermissionDTO = {
  id: string
  key: PermissionKey
  module: string
  title: string
  description: string | null
  assignable: boolean
  registeredAt: Date | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type RoleDTO = {
  id: string
  name: string
  description: string | null
  features: PermissionGrant[]
  isSuperAdmin: boolean
  protected: boolean
  isImmutable: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type CreateRoleDTO = {
  name: string
  description?: string | null
  features: PermissionGrant[]
}

export type UpdateRoleDTO = {
  name?: string
  description?: string | null
  features?: PermissionGrant[]
}
