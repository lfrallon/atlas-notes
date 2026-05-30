// utils
import {
  buildCursorPaginationQuery,
  CursorQuery,
  PaginationInput,
} from '@/routes/dashboard/admin-query'

// types
import type { Action } from '@/utils/auth'

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
  roleId: string
  permission: string
  createdAt: string
  role: {
    id: string
    name: string
    description: string | null
    isSystem: boolean
    createdAt: string
    updatedAt: string
  } | null
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
  resource: string
  action: Action | string
  key: string
  description: string
}

export interface UpdatePermissionRequest extends CreatePermissionRequest {
  permissionId: string
}

export interface PermissionMutationResponse extends PermissionRecord {}

export function getPermissionLabel(record: PermissionRecord): string {
  return record.permission
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
