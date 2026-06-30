import { zodResolver } from '@hookform/resolvers/zod'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Fragment, useCallback, useMemo, useState } from 'react'
import { Pencil, X } from 'lucide-react'
import { SubmitHandler, useForm } from 'react-hook-form'
import z from 'zod'

// custom components
import StatCard from '@/components/StatCard'
import StatusMessage from '@/components/StatusMessage'

// libs
import {
  getRoles,
  RoleMutationResponse,
  UpdateRoleRequest,
} from '@/lib/queries/roles'

// types
import type {
  CreateRoleRequest,
  RolesNodes,
  RolesPage,
} from '@/lib/queries/roles'
import type { CursorQuery, PaginationInput } from './admin-query'
import {
  getUserPermissions,
  UserPermissionsPage,
} from '@/lib/queries/permissions'

type RoleStats = {
  totalRoles: number
  loadedRoles: number
  systemRoles: number
  customRoles: number
}

interface DeleteRoleState {
  role: RolesNodes | null
  isOpen: boolean
}

const deleteRoleSchema = z.object({
  password: z
    .string()
    .min(8, `Confirm password must contain at least 8 characters.`)
    .regex(/[a-zA-Z]/, `Confirm password must contain at least one letter.`)
    .regex(/[0-9]/, `Confirm password must contain at least one number.`)
    .regex(
      /[^a-zA-Z0-9]/,
      `Confirm password must contain at least one special character.`,
    )
    .trim(),
  ids: z
    .array(z.string(), {
      error: "No id's provided.",
    })
    .meta({
      description: "Permission id's",
      example: ['123e4567-e89b-12d3-a456-426614174000'],
    }),
})

type DeleteRoleInputs = z.infer<typeof deleteRoleSchema>

const createRoleSchema = z.object({
  roleName: z.string().min(2, 'Role name.').max(30).trim(),
  description: z.string().min(2, 'Role description.').max(170).trim(),
  permissions: z
    .array(
      z.object({
        id: z.string('Permission id.'),
        createdAt: z.string('Permission created at.'),
        updatedAt: z.string('Permission updated at.'),
        action: z.enum(
          ['create', 'read', 'update', 'delete'],
          'Permission action.',
        ),
        resource: z.string('Permission resource.'),
        permission: z.string('Permission key.'),
        checked: z.boolean('Permission checked.'),
      }),
    )
    .meta({
      description: "Role permission id's.",
      example: `["123e4567-e89b-12d3-a456-426614174000"]`,
    }),
})

const updateRoleSchema = z.object({
  roleId: z.uuid('User role id.'),
  roleName: z.string().min(2, 'Role name.').max(30).trim().optional(),
  description: z
    .string()
    .min(2, 'Role description.')
    .max(170)
    .trim()
    .optional(),
  permissions: z
    .array(
      z.object({
        id: z.string('Permission id.'),
        createdAt: z.string('Permission created at.'),
        updatedAt: z.string('Permission updated at.'),
        action: z.enum(
          ['create', 'read', 'update', 'delete'],
          'Permission action.',
        ),
        resource: z.string('Permission resource.'),
        permission: z.string('Permission key.'),
        checked: z.boolean('Permission checked.'),
      }),
    )
    .meta({
      description: "Role permission id's.",
      example: `["123e4567-e89b-12d3-a456-426614174000"]`,
    }),
})

type CreateRoleInputs = z.infer<typeof createRoleSchema>

type UpdateRoleInputs = z.infer<typeof updateRoleSchema>

const ROLE_API_BASE_URL =
  import.meta.env.VITE_FASTIFY_API_URL ?? 'http://localhost:3006/api/v1'

const permissionsQueryKey = [
  'userPermissions',
  {
    baseUrl: `${ROLE_API_BASE_URL}/permissions`,
    input: {
      pageSize: 10,
      orderBy: 'desc' as const,
      limit: 25,
    },
  },
]

const FormError = ({ message }: { message?: string }) => {
  if (!message) return null

  return <p className="mt-1 text-xs text-red-300">{message}</p>
}

export const Route = createFileRoute('/dashboard/roles')({
  component: RouteComponent,
})

function RouteComponent() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [deleteRole, setDeleteRole] = useState<DeleteRoleState>({
    role: null,
    isOpen: false,
  })

  const {
    register: deleteRoleRegister,
    reset: deleteRoleReset,
    setValue: deleteRoleSetValue,
    handleSubmit: deleteRoleHandleSubmit,
    formState: { errors: deleteRoleErrors },
  } = useForm<DeleteRoleInputs>({
    resolver: zodResolver(deleteRoleSchema),
  })

  const {
    data: permissionsQuery,
    // hasNextPage: permissionsHasNextPage,
    // isLoading: permissionsIsLoading,
    // isError: permissionsIsError,
    // isFetchingNextPage: permissionsIsFetchingNextPage,
    // isSuccess: permissionsIsSuccess,
    // fetchNextPage: permissionsFetchNextPage,
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

  const {
    data,
    hasNextPage,
    isLoading,
    isError,
    isFetchingNextPage,
    isSuccess,
    fetchNextPage,
  } = useInfiniteQuery<RolesPage, Error>({
    queryKey: [
      'roles',
      {
        baseUrl: `${ROLE_API_BASE_URL}/roles`,
        input: {
          pageSize: 10,
          orderBy: 'desc',
          limit: 25,
        },
      },
    ],
    queryFn: async ({ pageParam, queryKey }) =>
      await getRoles({
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
      const response = await fetch(`${ROLE_API_BASE_URL}/roles/create`, {
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
      reset()
      await queryClient.invalidateQueries({
        queryKey: [
          'roles',
          {
            baseUrl: `${ROLE_API_BASE_URL}/roles`,
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
    mutationFn: async (data) => {
      const response = await fetch(`${ROLE_API_BASE_URL}/roles/update`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Unable to update role.')
      }

      const body: RoleMutationResponse = await response.json()
      return body
    },
    onSuccess: async () => {
      resetUpdateRole()
      await queryClient.invalidateQueries({
        queryKey: [
          'roles',
          {
            baseUrl: `${ROLE_API_BASE_URL}/roles`,
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

  const deleteRoleMutation = useMutation({
    mutationFn: async ({
      data,
    }: {
      data: { password: string; ids: string[] }
    }) => {
      const response = await fetch(`${ROLE_API_BASE_URL}/roles/delete`, {
        method: 'DELETE',
        headers: {
          accept: '*/*',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(errorData?.error || 'Failed to delete roles.')
      }
    },
    onSuccess: async () => {
      setDeleteRole({
        role: null,
        isOpen: false,
      })
      deleteRoleReset()
      await queryClient.invalidateQueries({
        queryKey: [
          'roles',
          {
            baseUrl: `${ROLE_API_BASE_URL}/roles`,
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

  const permissionOptions = useMemo(() => {
    const allPermissions = permissionsQuery?.pages.flatMap((page) =>
      page.nodes.map((node) => node),
    )

    return Array.from(new Set(allPermissions ?? []))
  }, [data])

  const {
    register,
    setValues,
    getValues,
    watch,
    handleSubmit,
    reset,
    formState: { errors: createRoleErrors },
  } = useForm<CreateRoleInputs>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      description: '',
      permissions: [],
      roleName: '',
    },
  })

  const {
    register: registerUpdateRole,
    setValues: setValuesUpdateRole,
    getValues: getValuesUpdateRole,
    watch: watchUpdateRole,
    handleSubmit: handleSubmitUpdateRole,
    reset: resetUpdateRole,
    formState: { errors: updateRoleErrors },
  } = useForm<UpdateRoleInputs>({
    resolver: zodResolver(updateRoleSchema),
    defaultValues: {
      description: '',
      permissions: [],
      roleId: '',
      roleName: '',
    },
  })

  const onCreateRole: SubmitHandler<CreateRoleInputs> = async (data) => {
    if (!data) return

    try {
      const { description, roleName, permissions } = data
      const permissionData = permissions.map((p) => p.id)
      await createRoleMutation.mutateAsync({
        description,
        roleName,
        permissions: permissionData,
      })
    } catch (error) {
      console.log('🚀 ~ onCreateRole ~ error:', error)
    }
  }

  const onUpdateRole: SubmitHandler<UpdateRoleInputs> = async (data) => {
    if (!data || selectedUpdateRoleId.trim().length === 0) return

    try {
      const { permissions, roleId, description, roleName } = data
      const permissionData = permissions ? permissions.map((p) => p.id) : []
      updateRoleMutation.mutate({
        roleId: roleId,
        permissions: permissionData.length === 0 ? null : permissionData,
        ...(roleName ? { roleName: roleName } : {}),
        ...(description ? { description: description } : {}),
      })
    } catch (error) {
      console.log('🚀 ~ onUpdateRole ~ error:', error)
    }
  }

  const handleCreatePermissionToggle = (id: string) => {
    const foundItem = permissionOptions.find((p) => p.id === id)
    const itemChecked = getValues('permissions').find((p) => p.id === id)

    if (foundItem) {
      if (itemChecked) {
        const unCheckedPerm = getValues('permissions').filter(
          (p) => p.id !== id,
        )
        setValues((previous) => ({
          ...previous,
          permissions: unCheckedPerm,
        }))
      } else {
        setValues((previous) => ({
          ...previous,
          permissions: [
            ...previous.permissions,
            { ...foundItem, checked: true },
          ],
        }))
      }
    }
  }

  const handleUpdatePermissionToggle = (id: string) => {
    const foundItem = permissionOptions.find((p) => p.id === id)
    const itemChecked = getValuesUpdateRole('permissions').find(
      (p) => p.id === id,
    )

    if (foundItem) {
      if (itemChecked) {
        const unCheckedPerm = getValuesUpdateRole('permissions').filter(
          (p) => p.id !== id,
        )
        setValuesUpdateRole((previous) => ({
          ...previous,
          permissions: unCheckedPerm,
        }))
      } else {
        setValuesUpdateRole((previous) => ({
          ...previous,
          permissions: [
            ...previous.permissions,
            { ...foundItem, checked: true },
          ],
        }))
      }
    }
  }

  const handleEditForm = (role: RolesNodes) => {
    setValuesUpdateRole(
      {
        roleId: role.id,
        roleName: role.name ?? undefined,
        description: role.description ?? undefined,
        permissions: role.permissions.map((p) => ({
          id: p.id,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          action: p.action,
          resource: p.resource,
          permission: p.permission,
          checked: true,
        })),
      },
      {
        shouldValidate: true,
      },
    )
  }

  const handleDeleteRole = (role: RolesNodes) => {
    deleteRoleReset()
    setDeleteRole({
      role,
      isOpen: true,
    })
    deleteRoleSetValue('ids', [role.id])
  }

  const onDeleteRoleCancel = () => {
    setDeleteRole({
      role: null,
      isOpen: false,
    })
    deleteRoleReset()
  }

  const onDeleteRole: SubmitHandler<DeleteRoleInputs> = useCallback(
    async (formValues) => {
      if (formValues.ids.length > 0) {
        await deleteRoleMutation.mutateAsync({
          data: { password: formValues.password, ids: formValues.ids },
        })
      }
    },
    [deleteRoleMutation],
  )

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

  const allRoles = useMemo(
    () => data?.pages.flatMap((page) => page.nodes) ?? [],
    [data],
  )

  const filteredRoles = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return allRoles

    return allRoles.filter((role) => {
      const permissionLabels = role.permissions.join(',')

      return [role.name, role.description, permissionLabels]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(term))
    })
  }, [search, allRoles])

  const roleStats = useMemo<RoleStats>(() => {
    const totalRoles = data?.pages.at(0)?.totalCount ?? allRoles.length

    return {
      totalRoles,
      loadedRoles: allRoles.length,
      systemRoles: allRoles.filter((role) => role?.isSystem).length,
      customRoles: allRoles.filter((role) => !role?.isSystem).length,
    }
  }, [allRoles, data])

  const selectedPermissions = watch('permissions')
  const selectedUpdateRolePermissions = watchUpdateRole('permissions')
  const selectedUpdateRoleId = watchUpdateRole('roleId')

  return (
    <div
      className="min-h-screen text-white gap-6"
      style={{
        background:
          'linear-gradient(135deg, #0c1a2b 0%, #1a2332 50%, #16202e 100%)',
      }}
    >
      <div className="w-full p-3 sm:p-6">
        <div className="border border-white/10 bg-white/3] p-5 shadow-2xl shadow-black/20 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
                Admin Console
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                Role Management
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-300">
                View and search roles, their permissions, and assignment usage.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-130">
              <StatCard label="Total" value={roleStats.totalRoles} />
              <StatCard label="Loaded" value={roleStats.loadedRoles} />
              <StatCard label="System" value={roleStats.systemRoles} />
              <StatCard label="Custom" value={roleStats.customRoles} />
            </div>
          </div>
        </div>

        <div className="mt-6 border border-gray-700 bg-gray-900/60 p-4 shadow-xl shadow-black/10">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold">Create user</h2>
              <p className="mt-1 text-sm text-gray-400">
                Add a role and assign their initial role.
              </p>
            </div>
            {isLoading && (
              <span className="text-xs text-gray-400">Loading roles…</span>
            )}
          </div>
          {createRoleMutation.isError && (
            <StatusMessage tone="danger">
              {createRoleMutation.error.message}
            </StatusMessage>
          )}
          <div className="mt-3 grid gap-3">
            <input
              {...register('roleName')}
              placeholder="Role name"
              disabled={createRoleMutation.isPending}
              className="w-full border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-cyan-500 disabled:opacity-60"
            />
            <FormError message={createRoleErrors.roleName?.message} />
            <textarea
              {...register('description')}
              placeholder="Role description"
              disabled={createRoleMutation.isPending}
              className="w-full border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-cyan-500 disabled:opacity-60"
            />
            <FormError message={createRoleErrors.description?.message} />
            <div>
              <p className="mb-2 text-sm font-medium">Permissions</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3 lg:grid-cols-6">
                {permissionOptions.map((permission) => {
                  return (
                    <label
                      key={permission.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        value={permission.id}
                        checked={
                          selectedPermissions.find(
                            (p) => p.id === permission.id,
                          )?.checked ?? false
                        }
                        onChange={(event) => {
                          handleCreatePermissionToggle(event.target.value)
                        }}
                        disabled={createRoleMutation.isPending}
                      />
                      <span>{permission.permission}</span>
                    </label>
                  )
                })}
              </div>
              <FormError message={createRoleErrors.permissions?.message} />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="reset"
              onClick={() => reset()}
              disabled={createRoleMutation.isPending}
              className="border border-gray-600 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={createRoleMutation.isPending}
              onClick={handleSubmit(onCreateRole)}
              className="border border-cyan-500/60 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createRoleMutation.isPending ? 'Creating role…' : 'Create role'}
            </button>
          </div>
        </div>

        <div className="mt-6 border border-gray-700 bg-gray-900/60 p-4">
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
            className="w-full border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-cyan-500"
          />
        </div>

        {isLoading && <StatusMessage>Loading roles…</StatusMessage>}
        {isError && (
          <StatusMessage tone="danger">
            Could not load roles. Check your API connection and admin session.
          </StatusMessage>
        )}
        {updateRoleMutation.isError && (
          <StatusMessage tone="danger">
            {updateRoleMutation.error.message}
          </StatusMessage>
        )}

        {isSuccess && (
          <div className="mt-6">
            <div className="hidden md:block overflow-hidden border border-gray-700">
              <table className="w-full table-auto border-collapse text-left text-sm">
                <thead className="bg-gray-800/80 text-gray-200">
                  <tr>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Permissions</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoles.map((role, index) => {
                    const isExpanded = selectedUpdateRoleId === role.id
                    const isUpdatingThisRole =
                      updateRoleMutation.isPending &&
                      updateRoleMutation.variables?.roleId === role.id
                    // const editingBlocked = role.isSystem

                    return (
                      <Fragment key={role.id.toString() + `${index}`}>
                        <tr className="border-t border-gray-700 align-top">
                          <td className="px-4 py-3 font-medium">{role.name}</td>
                          <td className="px-4 py-3 text-gray-300">
                            {role.description ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold ${
                                role.isSystem
                                  ? 'bg-violet-500/20 text-violet-200 border border-violet-400/40'
                                  : 'bg-gray-700/60 text-gray-200 border border-gray-600'
                              }`}
                            >
                              {role.isSystem ? 'System' : 'Custom'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {role.permissions.length > 0
                              ? role.permissions
                                  .map((p) => p.permission)
                                  .join(', ').length > 150
                                ? role.permissions
                                    .map((p) => p.permission)
                                    .join(', ')
                                    .slice(0, 170) + '...'
                                : role.permissions
                                    .map((p) => p.permission)
                                    .join(', ')
                              : 'No permissions'}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => {
                                // if (editingBlocked) return
                                if (isExpanded) {
                                  resetUpdateRole()
                                } else {
                                  handleEditForm(role)
                                }
                              }}
                              disabled={isUpdatingThisRole}
                              className="cursor-pointer border border-gray-400/40 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-500/10 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {
                                // editingBlocked ? (
                                //   <MonitorCog size={14} />
                                // ) :
                                isExpanded ? (
                                  <X size={14} />
                                ) : (
                                  <Pencil size={14} />
                                )
                              }
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-t border-gray-700 bg-gray-900/40">
                            <td colSpan={6} className="px-4 py-3">
                              <h3 className="text-md font-semibold">
                                Edit role
                              </h3>
                              <div className="mt-3 grid gap-3">
                                <input
                                  {...registerUpdateRole('roleName')}
                                  disabled={updateRoleMutation.isPending}
                                  className="w-full border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-cyan-500 disabled:opacity-60"
                                />
                                <textarea
                                  {...registerUpdateRole('description')}
                                  disabled={updateRoleMutation.isPending}
                                  className="w-full border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-cyan-500 disabled:opacity-60"
                                />
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-3 lg:grid-cols-6">
                                  {permissionOptions.map((permission) => (
                                    <div
                                      key={permission.id}
                                      className="flex gap-2"
                                    >
                                      <label className="flex items-center gap-2 text-sm">
                                        <input
                                          type="checkbox"
                                          value={permission.id}
                                          checked={
                                            selectedUpdateRolePermissions.find(
                                              (p) => p.id === permission.id,
                                            )?.checked ?? false
                                          }
                                          onChange={(event) => {
                                            handleUpdatePermissionToggle(
                                              event.target.value,
                                            )
                                          }}
                                          disabled={
                                            updateRoleMutation.isPending
                                          }
                                        />
                                      </label>
                                      <span>{permission.permission}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => resetUpdateRole()}
                                    disabled={updateRoleMutation.isPending}
                                    className="border border-gray-500/60 bg-gray-800/40 px-4 py-2 text-sm font-medium text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteRole(role)
                                    }}
                                    className="cursor-pointer border border-red-400/40 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Delete
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleSubmitUpdateRole(
                                      onUpdateRole,
                                    )}
                                    disabled={updateRoleMutation.isPending}
                                    className="border border-cyan-500/60 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {updateRoleMutation.isPending
                                      ? 'Saving…'
                                      : 'Save changes'}
                                  </button>
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
              {filteredRoles.map((role) => {
                const isExpanded = selectedUpdateRoleId === role.id
                // const isEditingBlocked = role.isSystem
                return (
                  <article
                    key={role.id}
                    className="border border-gray-700 bg-gray-900/60 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        // if (isEditingBlocked) return
                        if (isExpanded) {
                          resetUpdateRole()
                        } else {
                          handleEditForm(role)
                        }
                      }}
                      // disabled={isEditingBlocked}
                      className="w-full text-left p-4 hover:bg-gray-800/40 transition-colors disabled:cursor-not-allowed"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-lg font-semibold leading-tight">
                          {role.name}
                        </h2>
                        <div>
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold ${
                              role.isSystem
                                ? 'bg-violet-500/20 text-violet-200 border border-violet-400/40'
                                : 'bg-gray-700/60 text-gray-200 border border-gray-600'
                            }`}
                          >
                            {role.isSystem ? 'System' : 'Custom'}
                          </span>
                          {/* {!isEditingBlocked && ( */}
                          <span
                            className={`ml-2 inline-flex transform transition-transform text-gray-400 shrink-0 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          >
                            ▼
                          </span>
                          {/* )} */}
                        </div>
                      </div>

                      <p className="mt-2 text-sm text-gray-300">
                        {role.description ?? '—'}
                      </p>

                      {!isExpanded && (
                        <div className="mt-3 text-sm text-gray-300">
                          <p className="mt-1">
                            <span className="font-medium text-gray-100">
                              Permissions:
                            </span>{' '}
                            {role.permissions.length > 0
                              ? role.permissions
                                  .map((p) => p.permission)
                                  .join(', ')
                              : 'No permissions'}
                          </p>
                        </div>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-700 bg-gray-900/40 p-4">
                        <h2 className="text-lg font-semibold">Edit role</h2>
                        <div className="mt-3 grid gap-3">
                          <input
                            {...registerUpdateRole('roleName')}
                            placeholder="Role name"
                            disabled={updateRoleMutation.isPending}
                            className="w-full border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-cyan-500 disabled:opacity-60"
                          />
                          <FormError
                            message={updateRoleErrors.roleName?.message}
                          />
                          <textarea
                            {...registerUpdateRole('description')}
                            placeholder="Role description"
                            disabled={updateRoleMutation.isPending}
                            className="w-full border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-cyan-500 disabled:opacity-60"
                          />
                          <FormError
                            message={updateRoleErrors.description?.message}
                          />
                          <div>
                            <p className="mb-2 text-sm font-medium">
                              Permissions
                            </p>
                            <FormError
                              message={updateRoleErrors.permissions?.message}
                            />
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {permissionOptions.map((permission) => (
                                <label
                                  key={permission.id}
                                  className="flex items-center gap-2 text-sm"
                                >
                                  <input
                                    type="checkbox"
                                    value={permission.id}
                                    checked={
                                      selectedUpdateRolePermissions.find(
                                        (p) => p.id === permission.id,
                                      )?.checked ?? false
                                    }
                                    onChange={(event) => {
                                      handleUpdatePermissionToggle(
                                        event.target.value,
                                      )
                                    }}
                                    disabled={updateRoleMutation.isPending}
                                  />
                                  <span>{permission.permission}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => resetUpdateRole()}
                              disabled={updateRoleMutation.isPending}
                              className="flex-1 border border-gray-500/60 bg-gray-500/10 px-4 py-2 text-sm font-medium text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteRole(role)
                              }}
                              className="cursor-pointer border border-red-400/40 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={handleSubmitUpdateRole(onUpdateRole)}
                              disabled={updateRoleMutation.isPending}
                              className="flex-1 border border-cyan-500/60 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {updateRoleMutation.isPending
                                ? 'Saving…'
                                : 'Save'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                )
              })}
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
                className="border border-cyan-500/60 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
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

      {deleteRole.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm border border-gray-700 bg-gray-900 p-6 shadow-2xl shadow-black/30">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Delete Role
                </h2>
                <p className="text-xs text-gray-400">
                  Permanently remove created role.
                </p>
              </div>
              <button
                type="button"
                onClick={onDeleteRoleCancel}
                className="text-gray-400 transition-colors hover:text-gray-300"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {deleteRoleMutation.isError && (
              <div className="mb-4 border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {deleteRoleMutation.error?.message || 'Failed to delete role'}
              </div>
            )}

            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Enter your password
              </label>
              <input
                type="password"
                {...deleteRoleRegister('password')}
                placeholder="Enter your password"
                className="w-full border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none transition-colors focus:border-cyan-500"
              />
              <FormError message={deleteRoleErrors.password?.message} />
            </div>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Permission
              </label>
              <input
                type="text"
                disabled
                value={`${deleteRole.role?.name} - ${deleteRole.role?.description}`}
                className="w-full border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none transition-colors focus:border-cyan-500 disabled:opacity-60"
              />
              <FormError message={deleteRoleErrors.ids?.message} />
              <p className="mt-2 text-xs text-gray-400">
                Must enter your password to verify your identity in performing a
                role removal.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onDeleteRoleCancel}
                disabled={deleteRoleMutation.isPending}
                className="flex-1 border border-gray-600 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={deleteRoleHandleSubmit(onDeleteRole)}
                disabled={deleteRoleMutation.isPending}
                className="flex-1 bg-orange-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteRoleMutation.isPending ? 'Removing' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
