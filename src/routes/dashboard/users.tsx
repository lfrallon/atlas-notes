import { createFileRoute } from '@tanstack/react-router'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { useMemo, useState } from 'react'

// libs
import { getUserRoles } from '@/lib/queries/roles'
import { buildCursorPaginationQuery } from './admin-query'

// types
import type { UserRolesPage } from '@/lib/queries/roles'
import type { Permission } from '@/utils/auth'
import type { CursorQuery, PaginationInput } from './admin-query'

type TFetchUserAccounts = {
  pageParam: CursorQuery
  queryKey: [
    string,
    {
      baseUrl: string
      input?: PaginationInput
    },
  ]
}

interface UserAccountsNodes {
  user: {
    id: string
    name: string
    email: string
    image: string | null
    emailVerified: boolean
    createdAt: string
    updatedAt: string
    roleId: string | null
  }
  role: string | null
  permissions: Permission[]
}

type UserAccountsPage = {
  nodes: Array<UserAccountsNodes>
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

interface CreateUserRequest {
  name: string
  email: string
  password: string
  roleId: string
  permissions: Permission[]
}

async function getUserAccounts({ pageParam, queryKey }: TFetchUserAccounts) {
  const [, { baseUrl, input }] = queryKey

  const response = await fetch(
    `${baseUrl}?${buildCursorPaginationQuery(input, pageParam)}`,
    {
      credentials: 'include',
    },
  )

  const data: UserAccountsPage = await response.json()
  return data
}

const USER_API_BASE_URL =
  import.meta.env.VITE_FASTIFY_API_URL ?? 'http://localhost:3006/api/v1'

export const Route = createFileRoute('/dashboard/users')({
  component: UsersPage,
})

function UsersPage() {
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()
  const [createForm, setCreateForm] = useState<CreateUserRequest>({
    name: '',
    email: '',
    password: '',
    roleId: '',
    permissions: [],
  })

  const {
    data,
    hasNextPage,
    isLoading,
    isError,
    isFetchingNextPage,
    isSuccess,
    fetchNextPage,
  } = useInfiniteQuery<UserAccountsPage, Error>({
    queryKey: [
      'userAccounts',
      {
        baseUrl: `${USER_API_BASE_URL}/user/accounts`,
        input: {
          pageSize: 10,
          orderBy: 'desc',
        },
      },
    ],
    queryFn: async ({ pageParam, queryKey }) =>
      await getUserAccounts({
        pageParam: pageParam as CursorQuery,
        queryKey: queryKey as [
          string,
          {
            baseUrl: string
            input?: PaginationInput
          },
        ],
      }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => {
      console.log('🚀 ~ UsersPage ~ lastPage 1:', lastPage)

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

  const rolesQuery = useInfiniteQuery<UserRolesPage, Error>({
    queryKey: [
      'userRoles',
      {
        baseUrl: `${USER_API_BASE_URL}/user/roles`,
        input: {
          pageSize: 10,
          orderBy: 'desc',
          limit: 25,
        },
      },
    ],
    queryFn: async ({ pageParam, queryKey }) =>
      await getUserRoles({
        pageParam: pageParam as CursorQuery,
        queryKey: queryKey as [
          string,
          {
            baseUrl: string
            input?: PaginationInput
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

  const createUserMutation = useMutation({
    mutationFn: async (payload: CreateUserRequest) => {
      const response = await fetch(`${USER_API_BASE_URL}/user/accounts`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Failed to create user account')
      }
    },
    onSuccess: async () => {
      setCreateForm({
        name: '',
        email: '',
        password: '',
        roleId: '',
        permissions: [],
      })
      await queryClient.invalidateQueries({ queryKey: ['userAccounts'] })
    },
  })

  const updateScopeMutation = useMutation({
    mutationFn: async ({
      userId,
      scope,
    }: {
      userId: string
      scope: string
    }) => {
      const response = await fetch(
        `${USER_API_BASE_URL}/user/${userId}/scope`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ scope }),
        },
      )

      if (!response.ok) {
        throw new Error('Failed to update operational scope')
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [
          'userAccounts',
          {
            baseUrl: `${USER_API_BASE_URL}/user/accounts`,
            input: {
              pageSize: 10,
              orderBy: 'desc',
            },
          },
        ],
      })
    },
  })

  const fetchMoreUsers = async () => {
    if (hasNextPage && !isFetchingNextPage) {
      try {
        await fetchNextPage()
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : JSON.stringify(error)
        console.log('🚀 ~ fetchMoreUsers ~ errorMessage:', errorMessage)
      }
    }
  }

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase()
    const users = data?.pages.flatMap((page) => page.nodes) ?? []

    if (!term) return users

    return users.filter((account) => {
      return [
        account.user.name,
        account.user.email,
        account.role,
        account.permissions.join(','),
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(term))
    })
  }, [search, data])

  const roleOptions = useMemo(
    () => rolesQuery.data?.pages.flatMap((page) => page.nodes) ?? [],
    [rolesQuery.data],
  )

  const permissionOptions = useMemo(() => {
    return Array.from(
      new Set(roleOptions.flatMap((role) => role.permissions)),
    ).sort()
  }, [roleOptions])

  const togglePermission = (permission: Permission) => {
    setCreateForm((previous) => ({
      ...previous,
      permissions: previous.permissions.includes(permission)
        ? previous.permissions.filter((value) => value !== permission)
        : [...previous.permissions, permission],
    }))
  }

  return (
    <div
      className="min-h-screen text-white gap-6"
      style={{
        background:
          'linear-gradient(135deg, #0c1a2b 0%, #1a2332 50%, #16202e 100%)',
      }}
    >
      <div className="w-full p-3 sm:p-6">
        <h1 className="text-3xl font-bold">Admin • User Management</h1>
        <p className="mt-2 text-sm text-gray-300">
          View all users, create new accounts, and assign role-based
          permissions.
        </p>

        <form
          className="mt-6 rounded-lg border border-gray-700 bg-gray-900/60 p-4"
          onSubmit={(event) => {
            event.preventDefault()
            void createUserMutation.mutateAsync(createForm)
          }}
        >
          <h2 className="text-lg font-semibold">Create user</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              value={createForm.name}
              onChange={(event) =>
                setCreateForm((previous) => ({
                  ...previous,
                  name: event.target.value,
                }))
              }
              placeholder="Full name"
              className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm"
              required
            />
            <input
              type="email"
              value={createForm.email}
              onChange={(event) =>
                setCreateForm((previous) => ({
                  ...previous,
                  email: event.target.value,
                }))
              }
              placeholder="Email"
              className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm"
              required
            />
            <input
              type="password"
              minLength={8}
              value={createForm.password}
              onChange={(event) =>
                setCreateForm((previous) => ({
                  ...previous,
                  password: event.target.value,
                }))
              }
              placeholder="Temporary password"
              className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm"
              required
            />
            <select
              value={createForm.roleId}
              onChange={(event) =>
                setCreateForm((previous) => ({
                  ...previous,
                  roleId: event.target.value,
                }))
              }
              className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm"
              required
            >
              <option value="">Select role</option>
              {roleOptions.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3">
            <p className="mb-2 text-sm font-medium">Permissions</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {permissionOptions.map((permission) => (
                <label
                  key={permission}
                  className="flex items-center gap-2 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={createForm.permissions.includes(permission)}
                    onChange={() => togglePermission(permission)}
                  />
                  <span>{permission}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={
                createUserMutation.isPending ||
                createForm.permissions.length === 0
              }
              className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {createUserMutation.isPending ? 'Creating…' : 'Create user'}
            </button>
          </div>
        </form>

        <div className="mt-6 rounded-lg border border-gray-700 bg-gray-900/60 p-4">
          <label
            htmlFor="search-users"
            className="mb-2 block text-sm font-medium"
          >
            Search users
          </label>
          <input
            id="search-users"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter by name, email, role, or scope"
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-cyan-500"
          />
        </div>

        {isLoading && <p className="mt-4 text-sm">Loading users…</p>}
        {isError && (
          <p className="mt-4 text-sm text-red-400">
            Could not load users. Check your API connection and admin session.
          </p>
        )}

        {isSuccess && (
          <div className="mt-6">
            {/* Desktop / wide screens: table */}
            <div className="hidden md:block overflow-hidden rounded-lg border border-gray-700">
              <table className="w-full table-auto border-collapse text-left text-sm">
                <thead className="bg-gray-800/80 text-gray-200">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Operational Scope</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((account) => (
                    <tr
                      key={account.user.id}
                      className="border-t border-gray-700 align-top"
                    >
                      <td className="px-4 py-3">{account.user.name ?? '—'}</td>
                      <td className="px-4 py-3">{account.user.email ?? '—'}</td>
                      <td className="px-4 py-3">{account.role ?? '—'}</td>
                      <td className="px-4 py-3">
                        <form
                          className="flex items-center gap-2"
                          onSubmit={(event) => {
                            event.preventDefault()

                            const formData = new FormData(event.currentTarget)
                            const scope = String(
                              formData.get('scope') ?? '',
                            ).trim()

                            void updateScopeMutation.mutateAsync({
                              userId: account.user.id,
                              scope,
                            })
                          }}
                        >
                          <input
                            name="scope"
                            defaultValue={account.permissions.join(',') ?? ''}
                            placeholder="e.g. todos:read,map-messages:update"
                            className="w-full min-w-64 rounded-md border border-gray-600 bg-gray-800 px-3 py-2"
                          />
                          <button
                            type="submit"
                            className="rounded-md bg-cyan-600 px-3 py-2 font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
                            disabled={updateScopeMutation.isPending}
                          >
                            Save
                          </button>
                        </form>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {account.user.createdAt
                          ? new Date(account.user.createdAt).toLocaleString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data?.pages &&
                data.pages[data.pages.length - 1]?.pageInfo?.hasNextPage && (
                  <div className="flex justify-center mt-6 sm:mt-8">
                    <span className="inline-flex justify-center items-center gap-1 px-3 py-2 rounded-full text-orange-400 bg-orange-600/20 text-xs">
                      <button
                        onClick={fetchMoreUsers}
                        className="text-orange-400 hover:text-orange-300 transition-colors hover:cursor-pointer"
                      >
                        Load More
                      </button>
                    </span>
                  </div>
                )}
            </div>

            {/* Mobile: stacked cards */}
            <div className="md:hidden mt-2 space-y-3">
              {filteredUsers.map((account) => (
                <div
                  key={account.user.id}
                  className="rounded-lg border border-gray-700 bg-gray-900/50 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium">
                        {account.user.name ?? '—'}
                      </div>
                      <div className="mt-1 text-xs text-gray-300">
                        {account.user.email ?? '—'}
                      </div>
                      <div className="mt-1 text-xs text-gray-400">
                        Role: {account.role ?? '—'}
                      </div>
                    </div>
                    <div className="text-xs text-gray-300">
                      {account.user.createdAt
                        ? new Date(account.user.createdAt).toLocaleDateString()
                        : '—'}
                    </div>
                  </div>

                  <form
                    className="mt-3 flex flex-col gap-2"
                    onSubmit={(event) => {
                      event.preventDefault()

                      const formData = new FormData(event.currentTarget)
                      const scope = String(formData.get('scope') ?? '').trim()

                      void updateScopeMutation.mutateAsync({
                        userId: account.user.id,
                        scope,
                      })
                    }}
                  >
                    <input
                      name="scope"
                      defaultValue={account.permissions.join(',') ?? ''}
                      placeholder="e.g. todos:read,map-messages:update"
                      className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="rounded-md bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
                        disabled={updateScopeMutation.isPending}
                      >
                        Save
                      </button>
                    </div>
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
