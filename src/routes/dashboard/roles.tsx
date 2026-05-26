import { useInfiniteQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { z } from 'zod'

// types
import type { Permission } from '@/utils/auth'

const searchSchema = z
  .object({
    nextCursor: z
      .object({
        id: z.string(),
        updatedAt: z.string(),
      })
      .optional(),
  })
  .optional()

type SearchQuery = z.infer<typeof searchSchema>

type UserRolesInput = {
  pageSize?: number
  orderBy?: 'asc' | 'desc'
}

type TFetchUserRoles = {
  pageParam: SearchQuery
  queryKey: [
    string,
    {
      baseUrl: string
      input?: UserRolesInput
    },
  ]
}

type UserSelect = {
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

type UserRolesPage = {
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

async function getUserRoles({ pageParam, queryKey }: TFetchUserRoles) {
  const [, { baseUrl, input }] = queryKey

  const response = await fetch(
    `${baseUrl}?pageSize=${input?.pageSize ?? 10}&orderBy=${input?.orderBy ?? 'asc'}${pageParam?.nextCursor ? `&id=${pageParam.nextCursor.id}` : ''}${pageParam?.nextCursor ? `&updatedAt=${JSON.stringify(pageParam.nextCursor.updatedAt)}` : ''}`,
    {
      credentials: 'include',
    },
  )

  const data: UserRolesPage = await response.json()
  return data
}

const ROLE_API_BASE_URL =
  import.meta.env.VITE_FASTIFY_API_URL ?? 'http://localhost:3006/api/v1'

export const Route = createFileRoute('/dashboard/roles')({
  component: RouteComponent,
})

function RouteComponent() {
  const [search, setSearch] = useState('')

  const {
    data,
    hasNextPage,
    isLoading,
    isError,
    isFetchingNextPage,
    isSuccess,
    fetchNextPage,
  } = useInfiniteQuery<UserRolesPage, Error>({
    queryKey: [
      'userRoles',
      {
        baseUrl: `${ROLE_API_BASE_URL}/user/roles`,
        input: {
          pageSize: 10,
          orderBy: 'desc',
        },
      },
    ],
    queryFn: async ({ pageParam, queryKey }) =>
      await getUserRoles({
        pageParam: pageParam as SearchQuery,
        queryKey: queryKey as [
          string,
          {
            baseUrl: string
            input?: UserRolesInput
          },
        ],
      }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => {
      if ('error' in lastPage) {
        return undefined
      }

      if (lastPage.pageInfo.hasNextPage) {
        return {
          nextCursor: lastPage.pageInfo.nextCursor,
        }
      }
      return undefined
    },
  })

  const fetchMoreRoles = async () => {
    if (hasNextPage && !isFetchingNextPage) {
      try {
        await fetchNextPage()
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : JSON.stringify(error)
        console.log('🚀 ~ fetchMoreRoles ~ errorMessage:', errorMessage)
      }
    }
  }

  const filteredRoles = useMemo(() => {
    const term = search.trim().toLowerCase()
    const roles = data?.pages.flatMap((page) => page.nodes) ?? []

    if (!term) return roles

    return roles.filter((role) => {
      const permissionLabels = role.permissions.join(',')

      return [role.name, role.description, permissionLabels]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(term))
    })
  }, [search, data])

  return (
    <div
      className="min-h-screen text-white gap-6"
      style={{
        background:
          'linear-gradient(135deg, #0c1a2b 0%, #1a2332 50%, #16202e 100%)',
      }}
    >
      <div className="w-full p-3 sm:p-6">
        <h1 className="text-3xl font-bold">Admin • Role Management</h1>
        <p className="mt-2 text-sm text-gray-300">
          View and search roles, their permissions, and assignment usage.
        </p>

        <div className="mt-6 rounded-lg border border-gray-700 bg-gray-900/60 p-4">
          <label
            htmlFor="search-roles"
            className="mb-2 block text-sm font-medium"
          >
            Search roles
          </label>
          <input
            id="search-roles"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter by name, description, or permission"
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-cyan-500"
          />
        </div>

        {isLoading && <p className="mt-4 text-sm">Loading roles…</p>}
        {isError && (
          <p className="mt-4 text-sm text-red-400">
            Could not load roles. Check your API connection and admin session.
          </p>
        )}

        {isSuccess && (
          <div className="mt-6">
            <div className="hidden md:block overflow-hidden rounded-lg border border-gray-700">
              <table className="w-full table-auto border-collapse text-left text-sm">
                <thead className="bg-gray-800/80 text-gray-200">
                  <tr>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Users</th>
                    <th className="px-4 py-3">Permissions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoles.map((role) => (
                    <tr key={role.id} className="border-t border-gray-700 align-top">
                      <td className="px-4 py-3 font-medium">{role.name}</td>
                      <td className="px-4 py-3 text-gray-300">
                        {role.description ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            role.isSystem
                              ? 'bg-violet-500/20 text-violet-200 border border-violet-400/40'
                              : 'bg-gray-700/60 text-gray-200 border border-gray-600'
                          }`}
                        >
                          {role.isSystem ? 'System' : 'Custom'}
                        </span>
                      </td>
                      <td className="px-4 py-3">{role.users.length}</td>
                      <td className="px-4 py-3 text-gray-300">
                        {role.permissions.length > 0
                          ? role.permissions.join(', ')
                          : 'No permissions'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filteredRoles.map((role) => (
                <article
                  key={role.id}
                  className="rounded-lg border border-gray-700 bg-gray-900/60 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold leading-tight">{role.name}</h2>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        role.isSystem
                          ? 'bg-violet-500/20 text-violet-200 border border-violet-400/40'
                          : 'bg-gray-700/60 text-gray-200 border border-gray-600'
                      }`}
                    >
                      {role.isSystem ? 'System' : 'Custom'}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-gray-300">{role.description ?? '—'}</p>

                  <div className="mt-3 text-sm text-gray-300">
                    <p>
                      <span className="font-medium text-gray-100">Assigned users:</span>{' '}
                      {role.users.length}
                    </p>
                    <p className="mt-1">
                      <span className="font-medium text-gray-100">Permissions:</span>{' '}
                      {role.permissions.length > 0
                        ? role.permissions.join(', ')
                        : 'No permissions'}
                    </p>
                  </div>
                </article>
              ))}
            </div>

            {filteredRoles.length === 0 && (
              <p className="mt-4 text-sm text-gray-300">
                No roles match your current search.
              </p>
            )}

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={fetchMoreRoles}
                disabled={!hasNextPage || isFetchingNextPage}
                className="rounded-md border border-cyan-500/60 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isFetchingNextPage
                  ? 'Loading more...'
                  : hasNextPage
                    ? 'Load more roles'
                    : 'No more roles'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
