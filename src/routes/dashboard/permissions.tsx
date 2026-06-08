import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Fragment, useMemo, useState } from 'react'

// custom components
import StatCard from '@/components/StatCard'
import StatusMessage from '@/components/StatusMessage'

// libs
import {
  getPermissionLabel,
  getUserPermissions,
  PermissionMutationResponse,
  UpdatePermissionRequest,
} from '@/lib/queries/permissions'
import { getUserRoles, UserRolesPage } from '@/lib/queries/roles'

// types
import type {
  CreatePermissionRequest,
  PermissionRecord,
  UserPermissionsPage,
} from '@/lib/queries/permissions'
import type { CursorQuery, PaginationInput } from './admin-query'

type PermissionStats = {
  totalPermissions: number
  loadedPermissions: number
  systemPermissions: number
  rolesRepresented: number
}

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
  roleId: '',
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

  const rolesQuery = useInfiniteQuery<UserRolesPage, Error>({
    queryKey: [
      'userRoles',
      {
        baseUrl: `${PERMISSION_API_BASE_URL}/roles`,
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

  const createPermissionMutation = useMutation<
    PermissionMutationResponse,
    Error,
    CreatePermissionRequest
  >({
    mutationFn: async (payload) => {
      const response = await fetch(
        `${PERMISSION_API_BASE_URL}/permissions/create`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      )

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
    mutationFn: async (data) => {
      const response = await fetch(
        `${PERMISSION_API_BASE_URL}/permissions/update`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
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

  const allPermissions = useMemo(
    () => data?.pages.flatMap((page) => page.nodes) ?? [],
    [data],
  )

  const filteredPermissions = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return allPermissions

    return allPermissions.filter((permission) => {
      const permissionLabel = getPermissionLabel(permission)

      return [
        permissionLabel,
        permission.permission.split(':')[0] ?? '',
        permission.permission.split(':')[1] ?? '',
        permission.role?.description,
        getPermissionStatus(permission),
        permission.createdAt,
        permission.updatedAt,
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(term))
    })
  }, [search, allPermissions])

  const startEditing = (permission: PermissionRecord) => {
    if (permission.role?.isSystem) return

    setEditingPermissionId(permission.id)
    setEditForm({
      resource: permission.permission.split(':')[0] ?? '',
      action: permission.permission.split(':')[1] ?? '',
      key: getPermissionLabel(permission),
      roleId: permission.role?.id ?? '',
    })
  }

  const roleOptions = useMemo(
    () => rolesQuery.data?.pages.flatMap((page) => page.nodes) ?? [],
    [rolesQuery.data],
  )

  const permissionStats = useMemo<PermissionStats>(() => {
    const representedRoleIds = new Set(
      allPermissions.map((account) => account.roleId).filter(Boolean),
    )
    const totalPermissions =
      data?.pages.at(0)?.totalCount ?? allPermissions.length

    return {
      totalPermissions,
      loadedPermissions: allPermissions.length,
      systemPermissions: allPermissions.filter(
        (account) => account.role?.isSystem,
      ).length,
      rolesRepresented: representedRoleIds.size,
    }
  }, [allPermissions, data])

  return (
    <div
      className="min-h-screen text-white gap-6"
      style={{
        background:
          'linear-gradient(135deg, #0c1a2b 0%, #1a2332 50%, #16202e 100%)',
      }}
    >
      <div className="w-full p-3 sm:p-6">
        <div className="rounded-2xl border border-white/10 bg-white/3] p-5 shadow-2xl shadow-black/20 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
                Admin Console
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                Permission Management
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-300">
                View, search, create, and update permission definitions used by
                roles and users.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-130">
              <StatCard
                label="Total"
                value={permissionStats.totalPermissions}
              />
              <StatCard
                label="Loaded"
                value={permissionStats.loadedPermissions}
              />
              <StatCard
                label="System"
                value={permissionStats.systemPermissions}
              />
              <StatCard
                label="Roles"
                value={permissionStats.rolesRepresented}
              />
            </div>
          </div>
        </div>

        <form
          onSubmit={() => createPermissionMutation.mutate(createForm)}
          className="mt-6 rounded-xl border border-gray-700 bg-gray-900/60 p-4 shadow-xl shadow-black/10"
        >
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold">Create permission</h2>
              <p className="mt-1 text-sm text-gray-400">
                Add a permission and assign its initial role.
              </p>
            </div>
            {rolesQuery.isLoading && (
              <span className="text-xs text-gray-400">Loading roles…</span>
            )}
          </div>
          {createPermissionMutation.isError && (
            <StatusMessage tone="danger">
              {createPermissionMutation.error.message}
            </StatusMessage>
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
            <select
              value={createForm.roleId}
              onChange={(event) =>
                setCreateForm((previous) => ({
                  ...previous,
                  roleId: event.target.value,
                }))
              }
              disabled={createPermissionMutation.isPending}
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
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="reset"
              onClick={() => setCreateForm(emptyPermissionForm)}
              disabled={createPermissionMutation.isPending}
              className="rounded-md border border-gray-600 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                createPermissionMutation.isPending ||
                createForm.action.trim().length === 0 ||
                createForm.key.trim().length === 0 ||
                createForm.resource.trim().length === 0 ||
                createForm.roleId.trim().length === 0
              }
              className="rounded-md border border-cyan-500/60 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createPermissionMutation.isPending
                ? 'Creating permission…'
                : 'Create permission'}
            </button>
          </div>
        </form>

        <div className="mt-6 rounded-xl border border-gray-700 bg-gray-900/60 p-4 shadow-xl shadow-black/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label
              htmlFor="search-permissions"
              className="block flex-1 text-sm font-medium"
            >
              Search permissions
              <input
                id="search-permissions"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter by name, email, role, or permission"
                className="mt-2 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-500"
              />
            </label>
            <p className="text-sm text-gray-400">
              Showing{' '}
              <span className="font-semibold text-gray-100">
                {filteredPermissions.length}
              </span>{' '}
              of {allPermissions.length} loaded permissions
            </p>
          </div>
        </div>

        {isLoading && <StatusMessage>Loading permissions…</StatusMessage>}
        {isError && (
          <StatusMessage tone="danger">
            Could not load permissions. Check your API connection and admin
            session.
          </StatusMessage>
        )}
        {updatePermissionMutation.isError && (
          <StatusMessage tone="danger">
            {updatePermissionMutation.error.message}
          </StatusMessage>
        )}

        {isSuccess && (
          <div className="mt-6">
            <div className="hidden overflow-hidden rounded-lg border border-gray-700 md:block">
              <table className="w-full table-auto border-collapse text-left text-sm">
                <thead className="bg-gray-800/80 text-gray-200">
                  <tr>
                    <th className="px-4 py-3 w-10"></th>
                    <th className="px-4 py-3">Permission</th>
                    <th className="px-4 py-3">Resource</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPermissions.map((permission, index) => {
                    const isExpanded = editingPermissionId === permission.id
                    const editingBlocked = permission.role?.isSystem

                    return (
                      <Fragment key={permission.id.toString() + `${index}`}>
                        <tr
                          className="border-t border-gray-700 align-top cursor-pointer hover:bg-gray-800/40 transition-colors"
                          onClick={() => {
                            if (editingBlocked) return
                            if (isExpanded) {
                              setEditingPermissionId(null)
                            } else {
                              startEditing(permission)
                            }
                          }}
                        >
                          <td className="px-4 py-3">
                            {!editingBlocked && (
                              <span
                                className={`inline-flex transform transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              >
                                ▼
                              </span>
                            )}
                          </td>
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
                            {formatDate(permission.updatedAt)}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-t border-gray-700 bg-gray-900/40">
                            <td colSpan={8} className="px-4 py-4">
                              <div>
                                <h3 className="text-md font-semibold mb-3">
                                  Edit permission
                                </h3>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <input
                                    value={editForm.resource}
                                    onChange={(event) =>
                                      setEditForm((previous) => ({
                                        ...previous,
                                        resource: event.target.value,
                                      }))
                                    }
                                    disabled={
                                      updatePermissionMutation.isPending
                                    }
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
                                    disabled={
                                      updatePermissionMutation.isPending
                                    }
                                    className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-cyan-500 disabled:opacity-60"
                                  />
                                  <select
                                    value={editForm.roleId}
                                    onChange={(event) =>
                                      setEditForm((previous) => ({
                                        ...previous,
                                        roleId: event.target.value,
                                      }))
                                    }
                                    disabled={
                                      updatePermissionMutation.isPending
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
                                  <input
                                    value={editForm.key}
                                    onChange={(event) =>
                                      setEditForm((previous) => ({
                                        ...previous,
                                        key: event.target.value,
                                      }))
                                    }
                                    disabled={
                                      updatePermissionMutation.isPending
                                    }
                                    className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-cyan-500 disabled:opacity-60"
                                  />
                                  <div className="flex justify-end gap-2 sm:col-span-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditingPermissionId(null)
                                      }
                                      disabled={
                                        updatePermissionMutation.isPending
                                      }
                                      className="rounded-md border border-gray-500/60 bg-gray-800/40 px-4 py-2 text-sm font-medium text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!editingPermissionId) return
                                        updatePermissionMutation.mutate({
                                          id: editingPermissionId,
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
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filteredPermissions.map((permission) => {
                const isExpanded = editingPermissionId === permission.id
                const editingBlocked = permission.role?.isSystem

                return (
                  <article
                    key={permission.id.toString()}
                    className="rounded-lg border border-gray-700 bg-gray-900/60 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (editingBlocked) return
                        if (isExpanded) {
                          setEditingPermissionId(null)
                        } else {
                          startEditing(permission)
                        }
                      }}
                      disabled={editingBlocked}
                      className="w-full text-left p-4 hover:bg-gray-800/40 transition-colors disabled:cursor-not-allowed"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h2 className="text-lg font-semibold leading-tight">
                            {getPermissionLabel(permission)}
                          </h2>
                          <p className="mt-2 text-sm text-gray-300">
                            {permission.role?.description ?? '—'}
                          </p>
                        </div>
                        <div className="flex gap-2 items-start shrink-0">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              permission.role?.isSystem
                                ? 'bg-violet-500/20 text-violet-200 border border-violet-400/40'
                                : 'bg-gray-700/60 text-gray-200 border border-gray-600'
                            }`}
                          >
                            {getPermissionStatus(permission)}
                          </span>
                          {!editingBlocked && (
                            <span
                              className={`inline-flex transform transition-transform text-gray-400 shrink-0 ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            >
                              ▼
                            </span>
                          )}
                        </div>
                      </div>

                      {!isExpanded && (
                        <div className="mt-3 text-sm text-gray-300">
                          <p>
                            <span className="font-medium text-gray-100">
                              Resource:
                            </span>{' '}
                            {permission.permission.split(':')[0] ?? '—'}
                          </p>
                          <p className="mt-1">
                            <span className="font-medium text-gray-100">
                              User:
                            </span>{' '}
                            {permission.role?.name ?? '—'}
                          </p>
                          <p className="mt-1">
                            <span className="font-medium text-gray-100">
                              Created:
                            </span>{' '}
                            {formatDate(permission.createdAt)}
                          </p>
                        </div>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-700 bg-gray-900/40 p-4">
                        <h3 className="text-md font-semibold mb-3">
                          Edit permission
                        </h3>
                        <div className="grid gap-3">
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
                          <select
                            value={editForm.roleId}
                            onChange={(event) =>
                              setEditForm((previous) => ({
                                ...previous,
                                roleId: event.target.value,
                              }))
                            }
                            disabled={updatePermissionMutation.isPending}
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
                        <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
                          <button
                            type="button"
                            onClick={() => setEditingPermissionId(null)}
                            disabled={updatePermissionMutation.isPending}
                            className="rounded-md border border-gray-500/60 bg-gray-800/40 px-4 py-2 text-sm font-medium text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!editingPermissionId) return
                              updatePermissionMutation.mutate({
                                id: editingPermissionId,
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
                        </div>
                      </div>
                    )}
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
