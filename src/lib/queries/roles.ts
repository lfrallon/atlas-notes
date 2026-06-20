// utils
import {
  buildCursorPaginationQuery,
  CursorQuery,
  PaginationInput,
} from '@/routes/dashboard/admin-query'

export type TFetchRoles = {
  pageParam: CursorQuery
  queryKey: [
    string,
    {
      baseUrl: string
      input?: PaginationInput
    },
  ]
}

export type RolePermissions = {
  id: string
  createdAt: string
  updatedAt: string
  action: 'create' | 'read' | 'update' | 'delete'
  resource: string
  permission: string
}

export interface RolesNodes {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  createdAt: string
  updatedAt: string
  permissions: RolePermissions[]
}

export type RolesPage = {
  nodes: Array<RolesNodes>
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

export interface CreateRoleRequest {
  roleName: string
  description: string | null
  permissions: string[]
}

export interface UpdateRoleRequest {
  roleId: string
  roleName?: string
  description?: string
  permissions?: string[] | null
}

export interface RoleMutationResponse {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  createdAt: string
  updatedAt: string
  permissions: string[]
}

export async function getRoles({ pageParam, queryKey }: TFetchRoles) {
  const [, { baseUrl, input }] = queryKey

  const response = await fetch(
    `${baseUrl}?${buildCursorPaginationQuery(input, pageParam)}`,
    {
      credentials: 'include',
    },
  )

  const data: RolesPage = await response.json()
  return data
}
