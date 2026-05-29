// utils
import {
  buildCursorPaginationQuery,
  CursorQuery,
  PaginationInput,
} from '@/routes/dashboard/admin-query'

// types
import type { Action, Permission, Resource } from '@/utils/auth'

export type TFetchUserPermissions = {
  pageParam: CursorQuery
  queryKey: [
    string,
    {
      baseUrl: string
      input?: PaginationInput
    },
  ]
}

export interface PermissionRecord {
  id: string
  key?: Permission | string
  name?: Permission | string
  resource: Resource | string
  action: Action | string
  description: string | null
  isSystem: boolean
  createdAt?: string | null
  updatedAt?: string | null
}

export type UserPermissionsPage = {
  nodes: Array<PermissionRecord>
  pageInfo: {
    hasNextPage: boolean
    nextCursor: {
      id: string
      updatedAt: string
    }
    totalPages: number
  }
  totalCount: number
}

export interface CreatePermissionRequest {
  resource: Resource | string
  action: Action | string
  key: Permission | string
  description: string
}

export interface UpdatePermissionRequest extends CreatePermissionRequest {
  permissionId: string
}

export interface PermissionMutationResponse extends PermissionRecord {}

export function getPermissionLabel(permission: PermissionRecord): string {
  return (
    permission.key ??
    permission.name ??
    `${permission.resource}:${permission.action}`
  )
}

export async function getUserPermissions({
  pageParam,
  queryKey,
}: TFetchUserPermissions) {
  const [, { baseUrl, input }] = queryKey

  const response = await fetch(
    `${baseUrl}?${buildCursorPaginationQuery(input, pageParam)}`,
    {
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error('Unable to load permissions.')
  }

  const data: UserPermissionsPage = await response.json()
  return data
}
