// utils
import {
  buildCursorPaginationQuery,
  CursorQuery,
  PaginationInput,
} from '@/routes/dashboard/admin-query'

// types
import type { Permission } from '@/utils/auth'

export type TFetchUserRoles = {
  pageParam: CursorQuery
  queryKey: [
    string,
    {
      baseUrl: string
      input?: PaginationInput
    },
  ]
}

export type UserSelect = {
  id: string
  name: string
  email: string
  image: string | null
  emailVerified: boolean
  createdAt: string
  updatedAt: string
  roleId: string | null
}

interface UserRolesNodes {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  createdAt: string
  updatedAt: string
  users: UserSelect[]
  permissions: Permission[]
}

export type UserRolesPage = {
  nodes: Array<UserRolesNodes>
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
  name: string
  description: string
  permissions: Permission[]
}

export interface UpdateRoleRequest extends CreateRoleRequest {
  roleId: string
}

export interface RoleMutationResponse {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: Permission[]
  createdAt: string
  updatedAt: string
}

export async function getUserRoles({ pageParam, queryKey }: TFetchUserRoles) {
  const [, { baseUrl, input }] = queryKey

  const response = await fetch(
    `${baseUrl}?${buildCursorPaginationQuery(input, pageParam)}`,
    {
      credentials: 'include',
    },
  )

  const data: UserRolesPage = await response.json()
  return data
}
