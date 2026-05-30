import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

// libs
import {
  getPermissionLabel,
  getUserPermissions,
  PermissionMutationResponse,
  UpdatePermissionRequest,
} from '@/lib/queries/permissions'

// types
import type {
  CreatePermissionRequest,
  PermissionRecord,
  UserPermissionsPage,
} from '@/lib/queries/permissions'
import type { CursorQuery, PaginationInput } from './admin-query'

const PERMISSION_API_BASE_URL =
  import.meta.env.VITE_FASTIFY_API_URL ?? 'http://localhost:3006/api/v1'

const permissionsQueryKey = [
  'userPermissions',
  {
    baseUrl: `${PERMISSION_API_BASE_URL}/permissions`,
    input: {
      pageSize: 10,
      orderBy: 'desc' as const,
      limit: 25,
    },
  },
]

const emptyPermissionForm: CreatePermissionRequest = {
  resource: '',
  action: '',
  key: '',
  description: '',
}

export const Route = createFileRoute('/dashboard/permissions')({
  component: RouteComponent,
})

function formatDate(value?: string | null): string {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getPermissionStatus(permission: PermissionRecord): string {
  return permission.role?.isSystem ? 'System' : 'Custom'
}

function RouteComponent() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [editingPermissionId, setEditingPermissionId] = useState<string | null>(
    null,
  )
  const [createForm, setCreateForm] =
    useState<CreatePermissionRequest>(emptyPermissionForm)
  const [editForm, setEditForm] =
    useState<CreatePermissionRequest>(emptyPermissionForm)

  const {
    data,
    hasNextPage,
    isLoading,
    isError,
    isFetchingNextPage,
    isSuccess,
    fetchNextPage,
  } = useInfiniteQuery<UserPermissionsPage, Error>({
    queryKey: permissionsQueryKey,
    queryFn: async ({ pageParam, queryKey }) =>
      await getUserPermissions({
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

  const createPermissionMutation = useMutation<
    PermissionMutationResponse,
    Error,
    CreatePermissionRequest
  >({
    mutationFn: async (payload) => {
      const response = await fetch(`${PERMISSION_API_BASE_URL}/permissions`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Unable to create permission.')
      }

      const body: PermissionMutationResponse = await response.json()
      return body
    },
    onSuccess: async () => {
      setCreateForm(emptyPermissionForm)
      await queryClient.invalidateQueries({ queryKey: permissionsQueryKey })
    },
  })

  const updatePermissionMutation = useMutation<
    PermissionMutationResponse,
    Error,
    UpdatePermissionRequest
  >({
    mutationFn: async ({ permissionId, ...payload }) => {
      const response = await fetch(
        `${PERMISSION_API_BASE_URL}/permissions/${permissionId}`,
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
        throw new Error('Unable to update permission.')
      }

      const body: PermissionMutationResponse = await response.json()
      return body
    },
    onSuccess: async () => {
      setEditingPermissionId(null)
      await queryClient.invalidateQueries({ queryKey: permissionsQueryKey })
    },
  })

  const fetchMorePermissions = async () => {
    if (hasNextPage && !isFetchingNextPage) {
      try {
        await fetchNextPage()
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : JSON.stringify(error)
        console.log('🚀 ~ fetchMorePermissions ~ errorMessage:', errorMessage)
      }
    }
  }

  const permissions = data?.pages.flatMap((page) => page.nodes) ?? []

  const filteredPermissions = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return permissions

    return permissions.filter((permission) => {
      const permissionLabel = getPermissionLabel(permission)

      return [
        permissionLabel,
        permission.permission.split(':')[0] ?? '',
        permission.permission.split(':')[1] ?? '',
        permission.role?.description,
        getPermissionStatus(permission),
        permission.createdAt,
        permission.createdAt,
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(term))
    })
  }, [search, permissions])

  const startEditing = (permission: PermissionRecord) => {
    if (permission.role?.isSystem) return

    setEditingPermissionId(permission.id)
    setEditForm({
      resource: permission.permission.split(':')[0] ?? '',
      action: permission.permission.split(':')[1] ?? '',
      key: getPermissionLabel(permission),
      description: permission.role?.description ?? '',
    })
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
        <h1 className="text-3xl font-bold">Admin • Permission Management</h1>
        <p className="mt-2 text-sm text-gray-300">
          View, search, create, and update permission definitions used by roles
          and users.
        </p>

        <div className="mt-6 rounded-lg border border-gray-700 bg-gray-900/60 p-4">
          <h2 className="text-lg font-semibold">Create permission</h2>
          {createPermissionMutation.isError && (
            <p className="mt-3 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {createPermissionMutation.error.message}
            </p>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              value={createForm.resource}
              onChange={(event) =>
                setCreateForm((previous) => ({
                  ...previous,
                  resource: event.target.value,
                }))
              }
              placeholder="Resource (for example, todos)"
              disabled={createPermissionMutation.isPending}
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-cyan-500 disabled:opacity-60"
            />
            <input
              value={createForm.action}
              onChange={(event) =>
                setCreateForm((previous) => ({
                  ...previous,
                  action: event.target.value,
                }))
              }
              placeholder="Action (for example, read)"
              disabled={createPermissionMutation.isPending}
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-cyan-500 disabled:opacity-60"
            />
            <input
              value={createForm.key}
              onChange={(event) =>
                setCreateForm((previous) => ({
                  ...previous,
                  key: event.target.value,
                }))
              }
              placeholder="Permission key (for example, todos:read)"
              disabled={createPermissionMutation.isPending}
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
              placeholder="Permission description"
              disabled={createPermissionMutation.isPending}
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-cyan-500 disabled:opacity-60"
            />
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={() => createPermissionMutation.mutate(createForm)}
                disabled={
                  createPermissionMutation.isPending ||
                  !createForm.resource.trim() ||
                  !createForm.action.trim() ||
                  !createForm.key.trim()
                }
                className="rounded-md border border-cyan-500/60 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createPermissionMutation.isPending
                  ? 'Creating permission…'
                  : 'Create permission'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-gray-700 bg-gray-900/60 p-4">
          <label
            htmlFor="search-permissions"
            className="mb-2 block text-sm font-medium"
          >
            Search permissions
          </label>
          <input
            id="search-permissions"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter by key, resource, action, description, or status"
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-cyan-500"
          />
        </div>

        {isLoading && <p className="mt-4 text-sm">Loading permissions…</p>}
        {isError && (
          <p className="mt-4 text-sm text-red-400">
            Could not load permissions. Check your API connection and admin
            session.
          </p>
        )}

        {updatePermissionMutation.isError && (
          <p className="mt-4 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {updatePermissionMutation.error.message}
          </p>
        )}

        {isSuccess && (
          <div className="mt-6">
            <div className="hidden overflow-hidden rounded-lg border border-gray-700 md:block">
              <table className="w-full table-auto border-collapse text-left text-sm">
                <thead className="bg-gray-800/80 text-gray-200">
                  <tr>
                    <th className="px-4 py-3">Permission</th>
                    <th className="px-4 py-3">Resource</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPermissions.map((permission) => {
                    const isUpdatingThisPermission =
                      updatePermissionMutation.isPending &&
                      updatePermissionMutation.variables?.permissionId ===
                        permission.id
                    const editingBlocked = permission.role?.isSystem

                    return (
                      <tr
                        key={permission.id}
                        className="border-t border-gray-700 align-top"
                      >
                        <td className="px-4 py-3 font-medium">
                          {getPermissionLabel(permission)}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {permission.permission.split(':')[0] ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {permission.role?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {permission.role?.description ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              permission.role?.isSystem
                                ? 'bg-violet-500/20 text-violet-200 border border-violet-400/40'
                                : 'bg-gray-700/60 text-gray-200 border border-gray-600'
                            }`}
                          >
                            {getPermissionStatus(permission)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {formatDate(permission.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {formatDate(permission.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => startEditing(permission)}
                            disabled={
                              editingBlocked || isUpdatingThisPermission
                            }
                            className="rounded-md border border-gray-500/60 bg-gray-800/40 px-3 py-1 text-xs font-medium text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {editingBlocked ? 'System permission' : 'Edit'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {editingPermissionId && (
              <div className="mt-4 rounded-lg border border-gray-700 bg-gray-900/70 p-4">
                <h3 className="text-md font-semibold">Edit permission</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input
                    value={editForm.resource}
                    onChange={(event) =>
                      setEditForm((previous) => ({
                        ...previous,
                        resource: event.target.value,
                      }))
                    }
                    disabled={updatePermissionMutation.isPending}
                    className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-cyan-500 disabled:opacity-60"
                  />
                  <input
                    value={editForm.action}
                    onChange={(event) =>
                      setEditForm((previous) => ({
                        ...previous,
                        action: event.target.value,
                      }))
                    }
                    disabled={updatePermissionMutation.isPending}
                    className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-cyan-500 disabled:opacity-60"
                  />
                  <input
                    value={editForm.key}
                    onChange={(event) =>
                      setEditForm((previous) => ({
                        ...previous,
                        key: event.target.value,
                      }))
                    }
                    disabled={updatePermissionMutation.isPending}
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
                    disabled={updatePermissionMutation.isPending}
                    className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-cyan-500 disabled:opacity-60"
                  />
                  <div className="flex gap-2 sm:col-span-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!editingPermissionId) return
                        updatePermissionMutation.mutate({
                          permissionId: editingPermissionId,
                          ...editForm,
                        })
                      }}
                      disabled={
                        updatePermissionMutation.isPending ||
                        !editForm.resource.trim() ||
                        !editForm.action.trim() ||
                        !editForm.key.trim()
                      }
                      className="rounded-md border border-cyan-500/60 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {updatePermissionMutation.isPending
                        ? 'Saving…'
                        : 'Save changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPermissionId(null)}
                      disabled={updatePermissionMutation.isPending}
                      className="rounded-md border border-gray-500/60 bg-gray-800/40 px-4 py-2 text-sm font-medium text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filteredPermissions.map((permission) => {
                const isUpdatingThisPermission =
                  updatePermissionMutation.isPending &&
                  updatePermissionMutation.variables?.permissionId ===
                    permission.id

                return (
                  <article
                    key={permission.id}
                    className="rounded-lg border border-gray-700 bg-gray-900/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-lg font-semibold leading-tight">
                        {getPermissionLabel(permission)}
                      </h2>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          permission.role?.isSystem
                            ? 'bg-violet-500/20 text-violet-200 border border-violet-400/40'
                            : 'bg-gray-700/60 text-gray-200 border border-gray-600'
                        }`}
                      >
                        {getPermissionStatus(permission)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-gray-300">
                      {permission.role?.description ?? '—'}
                    </p>

                    <div className="mt-3 text-sm text-gray-300">
                      <p>
                        <span className="font-medium text-gray-100">
                          Resource:
                        </span>{' '}
                        {permission.permission.split(':')[0] ?? '—'}
                      </p>
                      <p className="mt-1">
                        <span className="font-medium text-gray-100">User:</span>{' '}
                        {permission.role?.name ?? '—'}
                      </p>
                      <p className="mt-1">
                        <span className="font-medium text-gray-100">
                          Created:
                        </span>{' '}
                        {formatDate(permission.createdAt)}
                      </p>
                      <p className="mt-1">
                        <span className="font-medium text-gray-100">
                          Updated:
                        </span>{' '}
                        {formatDate(permission.createdAt)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => startEditing(permission)}
                      disabled={
                        permission.role?.isSystem || isUpdatingThisPermission
                      }
                      className="mt-3 rounded-md border border-gray-500/60 bg-gray-800/40 px-3 py-1 text-xs font-medium text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {permission.role?.isSystem ? 'System permission' : 'Edit'}
                    </button>
                  </article>
                )
              })}
            </div>

            {filteredPermissions.length === 0 && (
              <p className="mt-4 text-sm text-gray-300">
                No permissions match your current search.
              </p>
            )}

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={fetchMorePermissions}
                disabled={!hasNextPage || isFetchingNextPage}
                className="rounded-md border border-cyan-500/60 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isFetchingNextPage
                  ? 'Loading more...'
                  : hasNextPage
                    ? 'Load more permissions'
                    : 'No more permissions'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
