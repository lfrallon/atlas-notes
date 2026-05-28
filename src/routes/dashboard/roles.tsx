import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

// libs
import {
  getUserRoles,
  RoleMutationResponse,
  UpdateRoleRequest,
} from '@/lib/queries/roles'

// types
import type { CreateRoleRequest, UserRolesPage } from '@/lib/queries/roles'
import type { CursorQuery, PaginationInput } from './admin-query'
import type { Permission } from '@/utils/auth'

const ROLE_API_BASE_URL =
  import.meta.env.VITE_FASTIFY_API_URL ?? 'http://localhost:3006/api/v1'

export const Route = createFileRoute('/dashboard/roles')({
  component: RouteComponent,
})

function RouteComponent() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)

  const [createForm, setCreateForm] = useState<CreateRoleRequest>({
    name: '',
    description: '',
    permissions: [],
  })
  const [editForm, setEditForm] = useState<CreateRoleRequest>({
    name: '',
    description: '',
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
  } = useInfiniteQuery<UserRolesPage, Error>({
    queryKey: [
      'userRoles',
      {
        baseUrl: `${ROLE_API_BASE_URL}/user/roles`,
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

  const createRoleMutation = useMutation<
    RoleMutationResponse,
    Error,
    CreateRoleRequest
  >({
    mutationFn: async (payload) => {
      const response = await fetch(`${ROLE_API_BASE_URL}/user/roles`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Unable to create role.')
      }

      const body: RoleMutationResponse = await response.json()
      return body
    },
    onSuccess: async () => {
      setCreateForm({ name: '', description: '', permissions: [] })
      await queryClient.invalidateQueries({
        queryKey: [
          'userRoles',
          {
            baseUrl: `${ROLE_API_BASE_URL}/user/roles`,
            input: {
              pageSize: 10,
              orderBy: 'desc',
              limit: 25,
            },
          },
        ],
      })
    },
  })

  const updateRoleMutation = useMutation<
    RoleMutationResponse,
    Error,
    UpdateRoleRequest
  >({
    mutationFn: async ({ roleId, ...payload }) => {
      const response = await fetch(
        `${ROLE_API_BASE_URL}/user/roles/${roleId}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      )

      if (!response.ok) {
        throw new Error('Unable to update role.')
      }

      const body: RoleMutationResponse = await response.json()
      return body
    },
    onSuccess: async () => {
      setEditingRoleId(null)
      await queryClient.invalidateQueries({
        queryKey: [
          'userRoles',
          {
            baseUrl: `${ROLE_API_BASE_URL}/user/roles`,
            input: {
              pageSize: 10,
              orderBy: 'desc',
              limit: 25,
            },
          },
        ],
      })
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

  const permissionOptions = useMemo(() => {
    const allPermissions = data?.pages.flatMap((page) =>
      page.nodes.flatMap((node) => node.permissions),
    )

    return Array.from(new Set(allPermissions ?? []))
  }, [data])

  const toggleCreatePermission = (permission: Permission) => {
    setCreateForm((previous) => ({
      ...previous,
      permissions: previous.permissions.includes(permission)
        ? previous.permissions.filter((item) => item !== permission)
        : [...previous.permissions, permission],
    }))
  }

  const toggleEditPermission = (permission: Permission) => {
    setEditForm((previous) => ({
      ...previous,
      permissions: previous.permissions.includes(permission)
        ? previous.permissions.filter((item) => item !== permission)
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
        <h1 className="text-3xl font-bold">Admin • Role Management</h1>
        <p className="mt-2 text-sm text-gray-300">
          View and search roles, their permissions, and assignment usage.
        </p>

        <div className="mt-6 rounded-lg border border-gray-700 bg-gray-900/60 p-4">
          <h2 className="text-lg font-semibold">Create role</h2>
          {createRoleMutation.isError && (
            <p className="mt-3 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {createRoleMutation.error.message}
            </p>
          )}
          <div className="mt-3 grid gap-3">
            <input
              value={createForm.name}
              onChange={(event) =>
                setCreateForm((previous) => ({
                  ...previous,
                  name: event.target.value,
                }))
              }
              placeholder="Role name"
              disabled={createRoleMutation.isPending}
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-cyan-500 disabled:opacity-60"
            />
            <textarea
              value={createForm.description}
              onChange={(event) =>
                setCreateForm((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
              placeholder="Role description"
              disabled={createRoleMutation.isPending}
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-cyan-500 disabled:opacity-60"
            />
            <div>
              <p className="mb-2 text-sm font-medium">Permissions</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {permissionOptions.map((permission) => (
                  <label
                    key={permission}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={createForm.permissions.includes(permission)}
                      onChange={() => toggleCreatePermission(permission)}
                      disabled={createRoleMutation.isPending}
                    />
                    <span>{permission}</span>
                  </label>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => createRoleMutation.mutate(createForm)}
              disabled={
                createRoleMutation.isPending ||
                !createForm.name.trim() ||
                createForm.permissions.length === 0
              }
              className="rounded-md border border-cyan-500/60 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createRoleMutation.isPending ? 'Creating role…' : 'Create role'}
            </button>
          </div>
        </div>

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

        {updateRoleMutation.isError && (
          <p className="mt-4 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {updateRoleMutation.error.message}
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
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoles.map((role) => {
                    const isEditing = editingRoleId === role.id
                    const isUpdatingThisRole =
                      updateRoleMutation.isPending &&
                      updateRoleMutation.variables?.roleId === role.id
                    const editingBlocked = role.isSystem

                    return (
                      <tr
                        key={role.id}
                        className="border-t border-gray-700 align-top"
                      >
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
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (editingBlocked) return
                              setEditingRoleId(role.id)
                              setEditForm({
                                name: role.name,
                                description: role.description ?? '',
                                permissions: role.permissions,
                              })
                            }}
                            disabled={editingBlocked || isUpdatingThisRole}
                            className="rounded-md border border-gray-500/60 bg-gray-800/40 px-3 py-1 text-xs font-medium text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {editingBlocked ? 'System role' : 'Edit'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {editingRoleId && (
              <div className="mt-4 rounded-lg border border-gray-700 bg-gray-900/70 p-4">
                <h3 className="text-md font-semibold">Edit role</h3>
                <div className="mt-3 grid gap-3">
                  <input
                    value={editForm.name}
                    onChange={(event) =>
                      setEditForm((previous) => ({
                        ...previous,
                        name: event.target.value,
                      }))
                    }
                    disabled={updateRoleMutation.isPending}
                    className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-cyan-500 disabled:opacity-60"
                  />
                  <textarea
                    value={editForm.description}
                    onChange={(event) =>
                      setEditForm((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }))
                    }
                    disabled={updateRoleMutation.isPending}
                    className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-cyan-500 disabled:opacity-60"
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {permissionOptions.map((permission) => (
                      <label
                        key={permission}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={editForm.permissions.includes(permission)}
                          onChange={() => toggleEditPermission(permission)}
                          disabled={updateRoleMutation.isPending}
                        />
                        <span>{permission}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!editingRoleId) return
                        updateRoleMutation.mutate({
                          roleId: editingRoleId,
                          ...editForm,
                        })
                      }}
                      disabled={
                        updateRoleMutation.isPending ||
                        !editForm.name.trim() ||
                        editForm.permissions.length === 0
                      }
                      className="rounded-md border border-cyan-500/60 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {updateRoleMutation.isPending
                        ? 'Saving…'
                        : 'Save changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingRoleId(null)}
                      disabled={updateRoleMutation.isPending}
                      className="rounded-md border border-gray-500/60 bg-gray-800/40 px-4 py-2 text-sm font-medium text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filteredRoles.map((role) => (
                <article
                  key={role.id}
                  className="rounded-lg border border-gray-700 bg-gray-900/60 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold leading-tight">
                      {role.name}
                    </h2>
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

                  <p className="mt-2 text-sm text-gray-300">
                    {role.description ?? '—'}
                  </p>

                  <div className="mt-3 text-sm text-gray-300">
                    <p>
                      <span className="font-medium text-gray-100">
                        Assigned users:
                      </span>{' '}
                      {role.users.length}
                    </p>
                    <p className="mt-1">
                      <span className="font-medium text-gray-100">
                        Permissions:
                      </span>{' '}
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
