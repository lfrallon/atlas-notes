import { createFileRoute } from '@tanstack/react-router'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { Fragment, useMemo, useRef, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import z from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

// helper
import { getUpdatedFieldValue } from '@/utils/helper'

// libs
import { getUserRoles } from '@/lib/queries/roles'
import { buildCursorPaginationQuery } from './admin-query'

// types
import type { UserRolesPage } from '@/lib/queries/roles'
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

interface UserInfo {
  id: string
  name: string
  firstName: string
  lastName: string
  email: string
  image: string | null
  emailVerified: boolean
  createdAt: string
  updatedAt: string
  roleId: string | null
}

interface UserAccountsNodes {
  user: UserInfo
  role: string | null
  permissions: string[]
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

interface CreateUserInputs {
  firstName: string
  lastName: string
  email: string
  password: string
  roleId: string
  image?: File | null
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

const USER_PROFILE_URL =
  import.meta.env.VITE_USER_PROFILE_URL ?? 'http://localhost:3006'
const createUserSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must contain at least 2 characters.')
    .max(30)
    .trim(),
  lastName: z
    .string()
    .min(2, 'Last name must contain at least 2 characters.')
    .max(30)
    .trim(),
  email: z.email('Must be a valid email address.').max(50).trim(),
  password: z
    .string()
    .min(8, `Password must contain at least 8 character.`)
    .regex(/[a-zA-Z]/, `Password must contain at least one letter.`)
    .regex(/[0-9]/, `Password must contain at least one number.`)
    .regex(
      /[^a-zA-Z0-9]/,
      `Password must contain at least one special character.`,
    )
    .trim(),
  roleId: z.uuidv4('Role is required.'),
  image: z.instanceof(File).or(z.null()).or(z.undefined()).optional(),
})

const passwordResetSchema = z
  .object({
    password: z
      .string()
      .min(8, `Password must contain at least 8 characters.`)
      .regex(/[a-zA-Z]/, `Password must contain at least one letter.`)
      .regex(/[0-9]/, `Password must contain at least one number.`)
      .regex(
        /[^a-zA-Z0-9]/,
        `Password must contain at least one special character.`,
      )
      .trim(),
    confirmPassword: z
      .string()
      .min(8, `Confirm password must contain at least 8 characters.`)
      .regex(/[a-zA-Z]/, `Confirm password must contain at least one letter.`)
      .regex(/[0-9]/, `Confirm password must contain at least one number.`)
      .regex(
        /[^a-zA-Z0-9]/,
        `Confirm password must contain at least one special character.`,
      )
      .trim(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords should be the same.',
  })

type ResetPasswordInputs = z.infer<typeof passwordResetSchema>

interface EditFormState {
  firstName: string
  lastName: string
  email: string
  roleId: string
  image: string | null
}

interface PasswordResetState {
  userId: string | null
  isOpen: boolean
}

const cloneFormData = (formData: FormData) => {
  const cloned = new FormData()

  formData.forEach((value, key) => {
    if (value instanceof File) {
      cloned.append(key, value, value.name)
    } else {
      cloned.append(key, String(value))
    }
  })

  return cloned
}

export const Route = createFileRoute('/dashboard/users')({
  component: UsersPage,
})

function UsersPage() {
  const queryClient = useQueryClient()

  const inputRef = useRef<HTMLInputElement>(null)
  const editImageInputRef = useRef<File | null>(null)

  const [search, setSearch] = useState('')
  const [isOnSubmit, setIsOnSubmit] = useState(false)
  const [editingUserData, setEditingUserData] = useState<UserInfo | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<EditFormState>({
    firstName: '',
    lastName: '',
    email: '',
    roleId: '',
    image: null,
  })
  const [passwordReset, setPasswordReset] = useState<PasswordResetState>({
    userId: null,
    isOpen: false,
  })

  const { register, setValue, handleSubmit, reset } = useForm<CreateUserInputs>(
    {
      resolver: zodResolver(createUserSchema),
    },
  )

  const {
    register: resetPasswordRegister,
    reset: resetPasswordReset,
    handleSubmit: resetPasswordHandleSubmit,
    formState: { errors: resetPasswordErrors },
  } = useForm<ResetPasswordInputs>({
    resolver: zodResolver(passwordResetSchema),
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
        baseUrl: `${USER_API_BASE_URL}/accounts`,
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
        baseUrl: `${USER_API_BASE_URL}/roles`,
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
    mutationFn: async ({ data }: { data: FormData }) => {
      const formData = cloneFormData(data)
      const response = await fetch(`${USER_API_BASE_URL}/user/create`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to create user account')
      }
    },
    onSuccess: async () => {
      if (inputRef.current) {
        inputRef.current.value = ''
      }
      reset()
      await queryClient.invalidateQueries({ queryKey: ['userAccounts'] })
    },
  })

  const updateUserMutation = useMutation({
    mutationFn: async ({ data }: { data: FormData }) => {
      const formData = cloneFormData(data)
      const response = await fetch(`${USER_API_BASE_URL}/user/update`, {
        method: 'PATCH',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to update user')
      }
    },
    onSuccess: async () => {
      setIsEditMode(false)
      setEditingUserData(null)
      setEditFormData({
        firstName: '',
        lastName: '',
        email: '',
        roleId: '',
        image: null,
      })
      setEditImagePreview(null)
      editImageInputRef.current = null
      await queryClient.invalidateQueries({ queryKey: ['userAccounts'] })
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ data }: { data: FormData }) => {
      const response = await fetch(`${USER_API_BASE_URL}/user/update`, {
        method: 'PATCH',
        credentials: 'include',
        body: data,
      })

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string }
        throw new Error(errorData.message || 'Failed to reset password')
      }
    },
    onSuccess: async () => {
      setPasswordReset({
        userId: null,
        isOpen: false,
      })
      resetPasswordReset()
      await queryClient.invalidateQueries({ queryKey: ['userAccounts'] })
    },
  })

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setValue('image', file, {
        shouldValidate: true,
      })
    }
  }

  const handleEditFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setEditImagePreview(URL.createObjectURL(file))
      setEditFormData((previous) => ({
        ...previous,
        image: file.name,
      }))
      editImageInputRef.current = file
    } else {
      setEditImagePreview(null)
    }
  }

  const onEditClick = (account: UserAccountsNodes) => {
    setEditFormData({
      firstName: account.user.firstName ?? '',
      lastName: account.user.lastName ?? '',
      email: account.user.email,
      roleId: account.user.roleId ?? '',
      image: account.user.image,
    })
    setEditImagePreview(
      account.user.image ? `${USER_PROFILE_URL}${account.user.image}` : null,
    )
    setEditingUserData(account.user)
    setIsEditMode(true)
  }

  const onCancelClick = () => {
    setIsEditMode(false)
    setEditFormData({
      firstName: '',
      lastName: '',
      email: '',
      roleId: '',
      image: null,
    })
    setEditImagePreview(null)
    if (editImageInputRef.current) {
      editImageInputRef.current = null
    }
  }

  const onResetPasswordClick = (userId: string) => {
    setPasswordReset({
      userId,
      isOpen: true,
    })
  }

  const onPasswordResetCancel = () => {
    setPasswordReset({
      userId: null,
      isOpen: false,
    })
  }

  const onPasswordResetSubmit: SubmitHandler<ResetPasswordInputs> = async (
    data,
  ) => {
    if (!passwordReset.userId) return

    try {
      const { confirmPassword, ...payload } = data
      const input = {
        userId: passwordReset.userId,
        ...payload,
      }

      const resetPasswordData = new FormData()
      resetPasswordData.append('userId', input.userId)
      resetPasswordData.append('password', input.password)

      await resetPasswordMutation.mutateAsync({
        data: resetPasswordData,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to reset password'
      console.error('Reset password error:', errorMessage)
    }
  }

  const onSaveClick = async () => {
    if (!editingUserData) return

    try {
      const inputs = {
        firstName: getUpdatedFieldValue(
          editingUserData.firstName,
          editFormData.firstName,
        ),
        lastName: getUpdatedFieldValue(
          editingUserData.lastName,
          editFormData.lastName,
        ),
        email: getUpdatedFieldValue(editingUserData.email, editFormData.email),
        roleId: getUpdatedFieldValue(
          editingUserData.roleId,
          editFormData.roleId,
        ),
      }
      const updateData = new FormData()
      updateData.append('userId', editingUserData.id)
      const { email, firstName, lastName, roleId } = inputs
      if ((firstName || lastName) && !editImageInputRef.current) {
        updateData.append('firstName', editFormData.firstName)
        updateData.append('lastName', editFormData.lastName)
        updateData.append(
          'name',
          `${editFormData.firstName} ${editFormData.lastName}`,
        )
      }
      if (email) {
        updateData.append('email', editFormData.email)
      }
      if (roleId) {
        updateData.append('roleId', editFormData.roleId)
      }

      if (editImageInputRef.current) {
        updateData.append('image', editImageInputRef.current)
        updateData.append('firstName', editingUserData.firstName)
        updateData.append('lastName', editingUserData.lastName)
        updateData.append(
          'name',
          `${editingUserData.firstName} ${editingUserData.lastName}`,
        )
      }

      await updateUserMutation.mutateAsync({
        data: updateData,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update user'
      console.error('Update user error:', errorMessage)
    }
  }

  const onCreateUser: SubmitHandler<CreateUserInputs> = async (data) => {
    const createUserData = new FormData()
    createUserData.append('firstName', data.firstName)
    createUserData.append('lastName', data.lastName)
    createUserData.append('email', data.email.toLowerCase())
    createUserData.append('password', data.password)
    createUserData.append('roleId', data.roleId)
    createUserData.append('image', data.image || '')
    setIsOnSubmit(true)

    try {
      await createUserMutation.mutateAsync({ data: createUserData })
    } catch (error) {
      setIsOnSubmit(false)
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred'
      console.log('🚀 ~ fetchMoreUsers ~ errorMessage:', errorMessage)
    }
  }

  const fetchMoreUsers = async () => {
    if (hasNextPage && !isFetchingNextPage) {
      try {
        await fetchNextPage()
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : JSON.stringify(error)
        console.log('🚀 ~ onCreateUser ~ errorMessage:', errorMessage)
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

        <form className="mt-6 rounded-lg border border-gray-700 bg-gray-900/60 p-4">
          <h2 className="text-lg font-semibold">Create user</h2>
          {createUserMutation.isError && (
            <p className="mt-3 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {createUserMutation.error.message}
            </p>
          )}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              {...register('firstName')}
              placeholder="First name"
              className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm"
              required
            />
            <input
              {...register('lastName')}
              placeholder="Last name"
              className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm"
              required
            />
            <input
              type="email"
              {...register('email')}
              placeholder="Email"
              className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm"
              required
            />
            <input
              type="password"
              minLength={8}
              {...register('password')}
              placeholder="Temporary password"
              className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm"
              required
            />
            <input
              type="file"
              id="image"
              accept="image/*"
              {...register('image', {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  handleFileChange(e)
                },
              })}
              ref={inputRef}
              className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm"
              autoComplete="off"
            />
            <select
              {...register('roleId')}
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
          <div className="mt-4 flex justify-end">
            <button
              type="reset"
              onClick={() => reset()}
              disabled={createUserMutation.isPending || isOnSubmit}
              style={{
                cursor: isOnSubmit ? 'not-allowed' : 'pointer',
              }}
              className="rounded-md border border-gray-600 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit(onCreateUser)}
              disabled={createUserMutation.isPending || isOnSubmit}
              style={{
                cursor: isOnSubmit ? 'not-allowed' : 'pointer',
              }}
              className="ml-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
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
            {/* Desktop / wide screens: table with expandable rows */}
            <div className="hidden md:block overflow-hidden rounded-lg border border-gray-700">
              <table className="w-full table-auto border-collapse text-left text-sm">
                <thead className="bg-gray-800/80 text-gray-200">
                  <tr>
                    <th className="px-4 py-3 w-10"></th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((account, index) => {
                    const isExpanded = editingUserData?.id === account.user.id

                    return (
                      <Fragment key={account.user.id.toString() + `${index}`}>
                        <tr
                          className="border-t border-gray-700 align-top cursor-pointer hover:bg-gray-800/40 transition-colors"
                          onClick={() => {
                            if (!isEditMode) {
                              if (isExpanded) {
                                setEditingUserData(null)
                              } else {
                                setEditingUserData(account.user)
                              }
                            }
                          }}
                        >
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex transform transition-transform ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            >
                              ▼
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {account.user.name ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {account.user.email ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {account.role ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {account.user.createdAt
                              ? new Date(
                                  account.user.createdAt,
                                ).toLocaleString()
                              : '—'}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr
                            key={
                              account.user.id.toString() +
                              account.user.roleId?.toString()
                            }
                            className="border-t border-gray-700 bg-gray-900/40"
                          >
                            <td colSpan={5} className="px-4 py-4">
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <h3 className="text-md font-semibold">
                                    User details
                                  </h3>
                                  {!isEditMode && (
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onResetPasswordClick(account.user.id)
                                        }
                                        className="text-xs font-medium text-orange-400 hover:text-orange-300 transition-colors"
                                      >
                                        Reset Password
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onEditClick(account)}
                                        className="text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                                      >
                                        Edit
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {!isEditMode ? (
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                      <p className="text-xs text-gray-400 mb-1">
                                        First Name
                                      </p>
                                      <p className="text-sm text-gray-100">
                                        {account.user.name?.split(' ')[0] ??
                                          '—'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-400 mb-1">
                                        Last Name
                                      </p>
                                      <p className="text-sm text-gray-100">
                                        {account.user.name?.split(' ')[1] ??
                                          '—'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-400 mb-1">
                                        Email
                                      </p>
                                      <p className="text-sm text-gray-100">
                                        {account.user.email ?? '—'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-400 mb-1">
                                        Role
                                      </p>
                                      <p className="text-sm text-gray-100">
                                        {account.role ?? '—'}
                                      </p>
                                    </div>
                                    <div className="sm:col-span-2">
                                      <p className="text-xs text-gray-400 mb-1">
                                        Permissions
                                      </p>
                                      <p className="text-sm text-gray-100">
                                        {account.permissions.length > 0
                                          ? account.permissions.join(', ')
                                          : '—'}
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-4">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                      <div>
                                        <label className="block text-xs text-gray-400 mb-1">
                                          First Name
                                        </label>
                                        <input
                                          type="text"
                                          value={editFormData.firstName}
                                          onChange={(e) =>
                                            setEditFormData((prev) => ({
                                              ...prev,
                                              firstName: e.target.value,
                                            }))
                                          }
                                          className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-400 mb-1">
                                          Last Name
                                        </label>
                                        <input
                                          type="text"
                                          value={editFormData.lastName}
                                          onChange={(e) =>
                                            setEditFormData((prev) => ({
                                              ...prev,
                                              lastName: e.target.value,
                                            }))
                                          }
                                          className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-400 mb-1">
                                          Email
                                        </label>
                                        <input
                                          type="email"
                                          value={editFormData.email}
                                          onChange={(e) =>
                                            setEditFormData((prev) => ({
                                              ...prev,
                                              email: e.target.value,
                                            }))
                                          }
                                          className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-400 mb-1">
                                          Role
                                        </label>
                                        <select
                                          value={editFormData.roleId}
                                          onChange={(e) =>
                                            setEditFormData((prev) => ({
                                              ...prev,
                                              roleId: e.target.value,
                                            }))
                                          }
                                          className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100"
                                        >
                                          <option value="">Select role</option>
                                          {roleOptions.map((role) => (
                                            <option
                                              key={role.id}
                                              value={role.id}
                                            >
                                              {role.name}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="sm:col-span-2">
                                        <label className="block text-xs text-gray-400 mb-1">
                                          Profile Picture
                                        </label>
                                        {editImagePreview && (
                                          <div className="mb-2">
                                            <img
                                              src={editImagePreview}
                                              alt="Profile preview"
                                              className="w-16 h-16 rounded object-cover"
                                            />
                                          </div>
                                        )}
                                        <input
                                          type="file"
                                          accept="image/*"
                                          onChange={handleEditFileChange}
                                          className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-700 file:text-gray-100 file:cursor-pointer"
                                        />
                                      </div>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2">
                                      <button
                                        type="button"
                                        onClick={onCancelClick}
                                        className="rounded-md border border-gray-600 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800/40 transition-colors"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={onSaveClick}
                                        disabled={updateUserMutation.isPending}
                                        className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-60"
                                      >
                                        {updateUserMutation.isPending
                                          ? 'Saving…'
                                          : 'Save'}
                                      </button>
                                    </div>
                                  </div>
                                )}
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

            {/* Mobile: stacked accordion cards */}
            <div className="md:hidden mt-2 space-y-3">
              {filteredUsers.map((account) => {
                const isExpanded = editingUserData?.id === account.user.id

                return (
                  <article
                    key={account.user.id.toString()}
                    className="rounded-lg border border-gray-700 bg-gray-900/60 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!isEditMode) {
                          if (isExpanded) {
                            setEditingUserData(null)
                          } else {
                            setEditingUserData(account.user)
                          }
                        }
                      }}
                      className="w-full text-left p-4 hover:bg-gray-800/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h2 className="text-lg font-semibold leading-tight">
                            {account.user.name ?? '—'}
                          </h2>
                          <p className="mt-2 text-sm text-gray-300">
                            {account.user.email ?? '—'}
                          </p>
                        </div>
                        <span
                          className={`inline-flex transform transition-transform text-gray-400 shrink-0 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        >
                          ▼
                        </span>
                      </div>

                      {!isExpanded && (
                        <div className="mt-3 text-sm text-gray-300">
                          <p>
                            <span className="font-medium text-gray-100">
                              Role:
                            </span>{' '}
                            {account.role ?? '—'}
                          </p>
                          <p className="mt-1">
                            <span className="font-medium text-gray-100">
                              Created:
                            </span>{' '}
                            {account.user.createdAt
                              ? new Date(
                                  account.user.createdAt,
                                ).toLocaleDateString()
                              : '—'}
                          </p>
                        </div>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-700 bg-gray-900/40 p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-md font-semibold">
                            User details
                          </h3>
                          {!isEditMode && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  onResetPasswordClick(account.user.id)
                                }
                                className="text-xs font-medium text-orange-400 hover:text-orange-300 transition-colors"
                              >
                                Reset Password
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditClick(account)}
                                className="text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                              >
                                Edit
                              </button>
                            </div>
                          )}
                        </div>

                        {!isEditMode ? (
                          <div className="grid gap-4">
                            <div>
                              <p className="text-xs text-gray-400 mb-1">
                                First Name
                              </p>
                              <p className="text-sm text-gray-100">
                                {account.user.name?.split(' ')[0] ?? '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">
                                Last Name
                              </p>
                              <p className="text-sm text-gray-100">
                                {account.user.name?.split(' ')[1] ?? '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">
                                Email
                              </p>
                              <p className="text-sm text-gray-100">
                                {account.user.email ?? '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Role</p>
                              <p className="text-sm text-gray-100">
                                {account.role ?? '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">
                                Permissions
                              </p>
                              <p className="text-sm text-gray-100">
                                {account.permissions.length > 0
                                  ? account.permissions.join(', ')
                                  : '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">
                                Created
                              </p>
                              <p className="text-sm text-gray-100">
                                {account.user.createdAt
                                  ? new Date(
                                      account.user.createdAt,
                                    ).toLocaleString()
                                  : '—'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="grid gap-3">
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">
                                  First Name
                                </label>
                                <input
                                  type="text"
                                  value={editFormData.firstName}
                                  onChange={(e) =>
                                    setEditFormData((prev) => ({
                                      ...prev,
                                      firstName: e.target.value,
                                    }))
                                  }
                                  className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">
                                  Last Name
                                </label>
                                <input
                                  type="text"
                                  value={editFormData.lastName}
                                  onChange={(e) =>
                                    setEditFormData((prev) => ({
                                      ...prev,
                                      lastName: e.target.value,
                                    }))
                                  }
                                  className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">
                                  Email
                                </label>
                                <input
                                  type="email"
                                  value={editFormData.email}
                                  onChange={(e) =>
                                    setEditFormData((prev) => ({
                                      ...prev,
                                      email: e.target.value,
                                    }))
                                  }
                                  className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">
                                  Role
                                </label>
                                <select
                                  value={editFormData.roleId}
                                  onChange={(e) =>
                                    setEditFormData((prev) => ({
                                      ...prev,
                                      roleId: e.target.value,
                                    }))
                                  }
                                  className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100"
                                >
                                  <option value="">Select role</option>
                                  {roleOptions.map((role) => (
                                    <option key={role.id} value={role.id}>
                                      {role.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">
                                  Profile Picture
                                </label>
                                {editImagePreview && (
                                  <div className="mb-2">
                                    <img
                                      src={editImagePreview}
                                      alt="Profile preview"
                                      className="w-16 h-16 rounded object-cover"
                                    />
                                  </div>
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleEditFileChange}
                                  className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gray-700 file:text-gray-100 file:cursor-pointer"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                              <button
                                type="button"
                                onClick={onCancelClick}
                                className="flex-1 rounded-md border border-gray-600 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800/40 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={onSaveClick}
                                disabled={updateUserMutation.isPending}
                                className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-60"
                              >
                                {updateUserMutation.isPending
                                  ? 'Saving…'
                                  : 'Save'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>

            {filteredUsers.length === 0 && (
              <p className="mt-4 text-sm text-gray-300">
                No users match your current search.
              </p>
            )}

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={fetchMoreUsers}
                disabled={!hasNextPage || isFetchingNextPage}
                className="rounded-md border border-cyan-500/60 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isFetchingNextPage
                  ? 'Loading more...'
                  : hasNextPage
                    ? 'Load more users'
                    : 'No more users'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Password Reset Modal */}
      {passwordReset.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border border-gray-700 bg-gray-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Reset Password
              </h2>
              <button
                type="button"
                onClick={onPasswordResetCancel}
                className="text-gray-400 hover:text-gray-300"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {resetPasswordMutation.isError && (
              <div className="mb-4 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {resetPasswordMutation.error?.message ||
                  'Failed to reset password'}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                New password
              </label>
              <input
                type="password"
                {...resetPasswordRegister('password')}
                placeholder="Enter new password"
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none focus:border-cyan-500"
              />
              {resetPasswordErrors.password && (
                <p className="text-sm opacity-50 text-red-400">
                  {resetPasswordErrors.password.message}
                </p>
              )}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Confirm password
              </label>
              <input
                type="password"
                {...resetPasswordRegister('confirmPassword')}
                placeholder="Enter confirm password"
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none focus:border-cyan-500"
              />
              {resetPasswordErrors.confirmPassword && (
                <p className="text-sm opacity-50 text-red-400">
                  {resetPasswordErrors.confirmPassword.message}
                </p>
              )}
              <p className="mt-2 text-xs text-gray-400">
                Password must contain at least 8 characters, including at least
                one letter, one number, and one special character.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onPasswordResetCancel}
                disabled={resetPasswordMutation.isPending}
                className="flex-1 rounded-md border border-gray-600 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800/40 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={resetPasswordHandleSubmit(onPasswordResetSubmit)}
                disabled={resetPasswordMutation.isPending}
                className="flex-1 rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-500 transition-colors disabled:opacity-60"
              >
                {resetPasswordMutation.isPending ? 'Resetting…' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
