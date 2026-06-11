import { zodResolver } from '@hookform/resolvers/zod'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  Fragment,
  memo,
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { CircleX, UserX } from 'lucide-react'
import z from 'zod'

// custom components
import DetailItem from '@/components/DetailItem'
import StatCard from '@/components/StatCard'
import StatusMessage from '@/components/StatusMessage'

// helper
import { getUpdatedFieldValue } from '@/utils/helper'

// libs
import { getUserRoles } from '@/lib/queries/roles'
import { buildCursorPaginationQuery } from './admin-query'
import { useSession } from '@/lib/auth-client'

// types
import type { UserRolesNodes, UserRolesPage } from '@/lib/queries/roles'
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

const EMPTY_EDIT_FORM: EditFormState = {
  firstName: '',
  lastName: '',
  email: '',
  roleId: '',
  image: null,
}

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

const deleteUserSchema = z.object({
  userId: z.string().min(2, 'User id is required.'),
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
})

type ResetPasswordInputs = z.infer<typeof passwordResetSchema>

type DeleteUserInputs = z.infer<typeof deleteUserSchema>

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

interface DeleteUserState {
  user: UserInfo | null
  isOpen: boolean
}

type UserStats = {
  totalUsers: number
  loadedUsers: number
  verifiedUsers: number
  rolesRepresented: number
}

type UserDetailsPanelProps = {
  account: UserAccountsNodes
  editFormData: EditFormState
  isEditMode: boolean
  isPending: boolean
  isSaving: boolean
  roleOptions: UserRolesNodes[]
  onCancel: () => void
  onEdit: (account: UserAccountsNodes) => void
  onEditFieldChange: (field: keyof EditFormState, value: string) => void
  onEditFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onDeleteUser: (user: UserInfo | null) => void
  onRemoveImage: () => void
  onResetPassword: (userId: string) => void
  onSave: () => void
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

const formatDateTime = (date: string | null | undefined) => {
  if (!date) return '—'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

const formatDate = (date: string | null | undefined) => {
  if (!date) return '—'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(date))
}

const getFullName = (user: UserInfo) =>
  [user.firstName, user.lastName].filter(Boolean).join(' ') || user.name || '—'

const resetEditForm = () => ({ ...EMPTY_EDIT_FORM })

const FormError = ({ message }: { message?: string }) => {
  if (!message) return null

  return <p className="mt-1 text-xs text-red-300">{message}</p>
}

const UserDetailsPanel = memo(function UserDetailsPanel({
  account,
  editFormData,
  isEditMode,
  isPending,
  isSaving,
  roleOptions,
  onCancel,
  onEdit,
  onEditFieldChange,
  onEditFileChange,
  onDeleteUser,
  onRemoveImage,
  onResetPassword,
  onSave,
}: UserDetailsPanelProps) {
  const { data: session } = useSession()
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  const clearImageInput = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => {
    event.stopPropagation()
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
    onRemoveImage()
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-md font-semibold">User details</h3>
          <p className="text-xs text-gray-400">ID: {account.user.id}</p>
        </div>
        {!isEditMode && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onResetPassword(account.user.id)}
              className="rounded-md border border-orange-400/40 px-3 py-1.5 text-xs font-medium text-orange-300 transition-colors hover:bg-orange-500/10 hover:text-orange-200"
            >
              Reset Password
            </button>
            <button
              type="button"
              onClick={() => onEdit(account)}
              className="rounded-md border border-cyan-400/40 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/10 hover:text-cyan-200"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={isPending || account.user.id === session?.user.id}
              onClick={(e) => {
                e.stopPropagation()
                onDeleteUser(account.user)
              }}
              className="block md:hidden cursor-pointer rounded-md border border-red-400/40 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UserX size={14} />
            </button>
          </div>
        )}
      </div>

      {!isEditMode ? (
        <>
          {account.user.image && (
            <div className="mb-2 text-xs text-gray-400">
              <p className="mb-1 text-xs text-gray-400">Profile Picture</p>
              <img
                src={`${USER_PROFILE_URL}${account.user.image}`}
                alt="Profile preview"
                className="h-16 w-16 rounded-lg border border-white/10 object-cover"
              />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-4 sm:grid-cols-3">
              <DetailItem label="First Name" value={account.user.firstName} />
              <DetailItem label="Last Name" value={account.user.lastName} />
              <DetailItem label="Email" value={account.user.email} />
              <DetailItem label="Role" value={account.role ?? '—'} />
              <DetailItem
                label="Email Status"
                value={account.user.emailVerified ? 'Verified' : 'Not verified'}
              />
              <DetailItem
                label="Created"
                value={formatDateTime(account.user.createdAt)}
              />
            </div>
            <div className="sm:col-span-2">
              <p className="mb-2 text-xs text-gray-400">Permissions</p>
              {account.permissions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {account.permissions.map((permission) => (
                    <span
                      key={permission}
                      className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100"
                    >
                      {permission}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-100">—</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-gray-400">
              First Name
              <input
                type="text"
                value={editFormData.firstName}
                onChange={(event) =>
                  onEditFieldChange('firstName', event.target.value)
                }
                className="mt-1 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none transition-colors focus:border-cyan-500"
              />
            </label>
            <label className="block text-xs text-gray-400">
              Last Name
              <input
                type="text"
                value={editFormData.lastName}
                onChange={(event) =>
                  onEditFieldChange('lastName', event.target.value)
                }
                className="mt-1 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none transition-colors focus:border-cyan-500"
              />
            </label>
            <label className="block text-xs text-gray-400">
              Email
              <input
                type="email"
                value={editFormData.email}
                onChange={(event) =>
                  onEditFieldChange('email', event.target.value)
                }
                className="mt-1 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none transition-colors focus:border-cyan-500"
              />
            </label>
            <label className="block text-xs text-gray-400">
              Role
              <select
                value={editFormData.roleId}
                onChange={(event) =>
                  onEditFieldChange('roleId', event.target.value)
                }
                className="mt-1 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none transition-colors focus:border-cyan-500"
              >
                <option value="">Select role</option>
                {roleOptions.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            {editFormData.image && (
              <div className="text-xs text-gray-400 col-span-1">
                Profile Picture
                <div className="flex flex-1 gap-3 mt-2">
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        editFormData.image.includes('/profile/')
                          ? `${USER_PROFILE_URL}${editFormData.image}`
                          : editFormData.image
                      }
                      alt="Profile preview"
                      className="h-16 w-16 rounded-lg border border-white/10 object-cover"
                    />
                    <span className="text-xs text-gray-400">
                      Preview updates before saving.
                    </span>
                  </div>
                  <div className="flex justify-center items-center">
                    <button
                      className="cursor-pointer rounded-md border border-red-400/40 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={clearImageInput}
                    >
                      <CircleX size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}
            <label className="block text-xs text-gray-400 sm:col-span-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={onEditFileChange}
                className="mt-2 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-gray-700 file:px-2 file:py-1 file:text-gray-100"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-gray-600 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800/40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
})

export const Route = createFileRoute('/dashboard/users')({
  component: UsersPage,
})

function UsersPage() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()

  const inputRef = useRef<HTMLInputElement | null>(null)
  const editImageInputRef = useRef<File | null>(null)

  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [editingUserData, setEditingUserData] = useState<UserInfo | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editFormData, setEditFormData] = useState<EditFormState>(resetEditForm)
  const [passwordReset, setPasswordReset] = useState<PasswordResetState>({
    userId: null,
    isOpen: false,
  })
  const [deleteUser, setDeleteUser] = useState<DeleteUserState>({
    user: null,
    isOpen: false,
  })

  const {
    register,
    setValue,
    handleSubmit,
    reset,
    formState: { errors: createUserErrors },
  } = useForm<CreateUserInputs>({
    resolver: zodResolver(createUserSchema),
  })

  const {
    register: resetPasswordRegister,
    reset: resetPasswordReset,
    handleSubmit: resetPasswordHandleSubmit,
    formState: { errors: resetPasswordErrors },
  } = useForm<ResetPasswordInputs>({
    resolver: zodResolver(passwordResetSchema),
  })

  const {
    register: deleteUserRegister,
    reset: deleteUserReset,
    handleSubmit: deleteUserHandleSubmit,
    formState: { errors: deleteUserErrors },
  } = useForm<DeleteUserInputs>({
    resolver: zodResolver(deleteUserSchema),
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
    mutationFn: async ({ data: formData }: { data: FormData }) => {
      const response = await fetch(`${USER_API_BASE_URL}/user/create`, {
        method: 'POST',
        credentials: 'include',
        body: cloneFormData(formData),
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          message?: string
        } | null
        throw new Error(errorData?.message || 'Failed to create user account')
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
    mutationFn: async ({ data: formData }: { data: FormData }) => {
      const response = await fetch(`${USER_API_BASE_URL}/user/update`, {
        method: 'PATCH',
        credentials: 'include',
        body: cloneFormData(formData),
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          message?: string
        } | null
        throw new Error(errorData?.message || 'Failed to update user')
      }
    },
    onSuccess: async () => {
      setIsEditMode(false)
      setEditingUserData(null)
      setEditFormData(resetEditForm())
      editImageInputRef.current = null
      await queryClient.invalidateQueries({ queryKey: ['userAccounts'] })
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ data: formData }: { data: FormData }) => {
      const response = await fetch(`${USER_API_BASE_URL}/user/update`, {
        method: 'PATCH',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          message?: string
        } | null
        throw new Error(errorData?.message || 'Failed to reset password')
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

  const deleteUserMutation = useMutation({
    mutationFn: async ({ data: formData }: { data: FormData }) => {
      const response = await fetch(`${USER_API_BASE_URL}/accounts`, {
        method: 'DELETE',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as {
          message?: string
        } | null
        throw new Error(errorData?.message || 'Failed to delete user')
      }
    },
    onSuccess: async () => {
      setDeleteUser({
        user: null,
        isOpen: false,
      })
      deleteUserReset()
      await queryClient.invalidateQueries({ queryKey: ['userAccounts'] })
    },
  })

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null
      setValue('image', file, {
        shouldValidate: true,
      })
    },
    [setValue],
  )

  const handleEditFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      editImageInputRef.current = null
      setEditFormData((previous) => ({
        ...previous,
        image: null,
      }))

      const file = event.target.files?.[0]
      if (file) {
        if (editFormData.image?.startsWith('blob:')) {
          URL.revokeObjectURL(editFormData.image)
        }
        setEditFormData((previous) => ({
          ...previous,
          image: URL.createObjectURL(file),
        }))
        editImageInputRef.current = file
      }

      setValue('image', file, {
        shouldValidate: true,
      })
    },
    [],
  )

  const onEditFieldChange = useCallback(
    (field: keyof EditFormState, value: string) => {
      setEditFormData((previous) => ({
        ...previous,
        [field]: value,
      }))
    },
    [],
  )

  const onEditClick = useCallback((account: UserAccountsNodes) => {
    setEditFormData({
      firstName: account.user.firstName ?? '',
      lastName: account.user.lastName ?? '',
      email: account.user.email,
      roleId: account.user.roleId ?? '',
      image: account.user.image,
    })
    editImageInputRef.current = null
    setEditingUserData(account.user)
    setIsEditMode(true)
  }, [])

  const onCancelClick = useCallback(() => {
    setIsEditMode(false)
    setEditFormData(resetEditForm())
    editImageInputRef.current = null
  }, [])

  const onRemoveImage = useCallback(() => {
    if (editFormData.image?.startsWith('blob:')) {
      URL.revokeObjectURL(editFormData.image)
    }
    setEditFormData((previous) => ({
      ...previous,
      image: null,
    }))
    editImageInputRef.current = null
  }, [])

  const onDeleteUserClick = useCallback((user: UserInfo | null) => {
    setDeleteUser({
      user,
      isOpen: true,
    })
    deleteUserReset()
  }, [])

  const onDeleteUserCancel = useCallback(() => {
    setDeleteUser({
      user: null,
      isOpen: false,
    })
    deleteUserReset()
  }, [])

  const onDeleteUserSubmit: SubmitHandler<DeleteUserInputs> = useCallback(
    async (formValues) => {
      if (!deleteUser.user) return

      const deleteUserData = new FormData()
      deleteUserData.append('userId', deleteUser.user.id)
      deleteUserData.append('password', formValues.password)

      await deleteUserMutation.mutateAsync({
        data: deleteUserData,
      })
    },
    [deleteUser.user, deleteUserMutation],
  )

  const onResetPasswordClick = useCallback((userId: string) => {
    setPasswordReset({
      userId,
      isOpen: true,
    })
  }, [])

  const onPasswordResetCancel = useCallback(() => {
    setPasswordReset({
      userId: null,
      isOpen: false,
    })
    resetPasswordReset()
  }, [resetPasswordReset])

  const onPasswordResetSubmit: SubmitHandler<ResetPasswordInputs> = useCallback(
    async (formValues) => {
      if (!passwordReset.userId) return

      const resetPasswordData = new FormData()
      resetPasswordData.append('userId', passwordReset.userId)
      resetPasswordData.append('password', formValues.password)

      await resetPasswordMutation.mutateAsync({
        data: resetPasswordData,
      })
    },
    [passwordReset.userId, resetPasswordMutation],
  )

  const onSaveClick = useCallback(async () => {
    if (!editingUserData) return

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
      roleId: getUpdatedFieldValue(editingUserData.roleId, editFormData.roleId),
      image: getUpdatedFieldValue(editingUserData.image, editFormData.image),
    }

    const updateData = new FormData()
    updateData.append('userId', editingUserData.id)

    if (inputs.firstName || inputs.lastName) {
      updateData.append('firstName', editFormData.firstName)
      updateData.append('lastName', editFormData.lastName)
      updateData.append(
        'name',
        `${editFormData.firstName} ${editFormData.lastName}`,
      )
    }
    if (inputs.email) {
      updateData.append('email', editFormData.email.toLowerCase())
    }
    if (inputs.roleId) {
      updateData.append('roleId', editFormData.roleId)
    }

    if (inputs.image === null) {
      updateData.append('image', 'null')
    }

    if (inputs.image && inputs.image.trim().length > 0) {
      if (editImageInputRef.current) {
        updateData.append('image', editImageInputRef.current)

        if (!inputs.firstName && !inputs.lastName) {
          updateData.append('firstName', editingUserData.firstName)
          updateData.append('lastName', editingUserData.lastName)
          updateData.append(
            'name',
            `${editingUserData.firstName} ${editingUserData.lastName}`,
          )
        }
      }
    }

    await updateUserMutation.mutateAsync({
      data: updateData,
    })
  }, [editFormData, editingUserData, updateUserMutation])

  const onCreateUser: SubmitHandler<CreateUserInputs> = useCallback(
    async (formValues) => {
      const createUserData = new FormData()
      createUserData.append('firstName', formValues.firstName)
      createUserData.append('lastName', formValues.lastName)
      createUserData.append('email', formValues.email.toLowerCase())
      createUserData.append('password', formValues.password)
      createUserData.append('roleId', formValues.roleId)
      if (formValues.image) {
        createUserData.append('image', formValues.image)
      }

      await createUserMutation.mutateAsync({ data: createUserData })
    },
    [createUserMutation],
  )

  const fetchMoreUsers = useCallback(async () => {
    if (hasNextPage && !isFetchingNextPage) {
      await fetchNextPage()
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const toggleUserExpanded = useCallback(
    (account: UserAccountsNodes) => {
      if (isEditMode) return

      setEditingUserData((current) =>
        current?.id === account.user.id ? null : account.user,
      )
    },
    [isEditMode],
  )

  const allUsers = useMemo(
    () => data?.pages.flatMap((page) => page.nodes) ?? [],
    [data],
  )

  const filteredUsers = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase()

    if (!term) return allUsers

    return allUsers.filter((account) =>
      [
        getFullName(account.user),
        account.user.email,
        account.role,
        account.permissions.join(','),
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(term)),
    )
  }, [allUsers, deferredSearch])

  const roleOptions = useMemo(
    () => rolesQuery.data?.pages.flatMap((page) => page.nodes) ?? [],
    [rolesQuery.data],
  )

  const userStats = useMemo<UserStats>(() => {
    const representedRoleIds = new Set(
      allUsers.map((account) => account.user.roleId).filter(Boolean),
    )
    const totalUsers = data?.pages.at(0)?.totalCount ?? allUsers.length

    return {
      totalUsers,
      loadedUsers: allUsers.length,
      verifiedUsers: allUsers.filter((account) => account.user.emailVerified)
        .length,
      rolesRepresented: representedRoleIds.size,
    }
  }, [allUsers, data])

  return (
    <div
      className="min-h-screen text-white"
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
                User Management
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-300">
                View users, create accounts, reset credentials, and tune
                role-based access from one responsive workspace.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-130">
              <StatCard label="Total" value={userStats.totalUsers} />
              <StatCard label="Loaded" value={userStats.loadedUsers} />
              <StatCard label="Verified" value={userStats.verifiedUsers} />
              <StatCard label="Roles" value={userStats.rolesRepresented} />
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit(onCreateUser)}
          className="mt-6 rounded-xl border border-gray-700 bg-gray-900/60 p-4 shadow-xl shadow-black/10"
        >
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold">Create user</h2>
              <p className="mt-1 text-sm text-gray-400">
                Add a teammate and assign their initial role.
              </p>
            </div>
            {rolesQuery.isLoading && (
              <span className="text-xs text-gray-400">Loading roles…</span>
            )}
          </div>
          {createUserMutation.isError && (
            <StatusMessage tone="danger">
              {createUserMutation.error.message}
            </StatusMessage>
          )}
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-xs font-medium text-gray-300">
              First name
              <input
                {...register('firstName')}
                placeholder="John"
                className="mt-1 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-500"
                required
              />
              <FormError message={createUserErrors.firstName?.message} />
            </label>
            <label className="text-xs font-medium text-gray-300">
              Last name
              <input
                {...register('lastName')}
                placeholder="Doe"
                className="mt-1 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-500"
                required
              />
              <FormError message={createUserErrors.lastName?.message} />
            </label>
            <label className="text-xs font-medium text-gray-300">
              Email
              <input
                type="email"
                {...register('email')}
                placeholder="john.doe@example.com"
                className="mt-1 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-500"
                required
              />
              <FormError message={createUserErrors.email?.message} />
            </label>
            <label className="text-xs font-medium text-gray-300">
              Temporary password
              <input
                type="password"
                minLength={8}
                {...register('password')}
                placeholder="Include letters, numbers, symbols"
                className="mt-1 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-500"
                required
              />
              <FormError message={createUserErrors.password?.message} />
            </label>
            <label className="text-xs font-medium text-gray-300">
              Profile image
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
                className="mt-1 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-gray-700 file:px-1.5 file:text-gray-100"
                autoComplete="off"
              />
              <FormError message={createUserErrors.image?.message} />
            </label>
            <label className="text-xs font-medium text-gray-300">
              Role
              <select
                {...register('roleId')}
                className="mt-1 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-500"
                required
              >
                <option value="">Select role</option>
                {roleOptions.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <FormError message={createUserErrors.roleId?.message} />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="reset"
              onClick={() => reset()}
              disabled={createUserMutation.isPending}
              className="rounded-md border border-gray-600 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createUserMutation.isPending}
              className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createUserMutation.isPending ? 'Creating…' : 'Create user'}
            </button>
          </div>
        </form>

        <div className="mt-6 rounded-xl border border-gray-700 bg-gray-900/60 p-4 shadow-xl shadow-black/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label
              htmlFor="search-users"
              className="block flex-1 text-sm font-medium"
            >
              Search users
              <input
                id="search-users"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter by name, email, role, or permission"
                className="mt-2 w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none transition-colors focus:border-cyan-500"
              />
            </label>
            <p className="text-sm text-gray-400">
              Showing{' '}
              <span className="font-semibold text-gray-100">
                {filteredUsers.length}
              </span>{' '}
              of {allUsers.length} loaded users
            </p>
          </div>
        </div>

        {isLoading && <StatusMessage>Loading users…</StatusMessage>}
        {isError && (
          <StatusMessage tone="danger">
            Could not load users. Check your API connection and admin session.
          </StatusMessage>
        )}
        {updateUserMutation.isError && (
          <StatusMessage tone="danger">
            {updateUserMutation.error.message}
          </StatusMessage>
        )}

        {isSuccess && (
          <div className="mt-6">
            <div className="hidden md:block overflow-hidden rounded-lg border border-gray-700">
              <table className="w-full table-auto border-collapse text-left text-sm">
                <thead className="bg-gray-800/80 text-gray-200">
                  <tr>
                    <th className="w-10 px-4 py-3"></th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((account) => {
                    const isExpanded = editingUserData?.id === account.user.id

                    return (
                      <Fragment key={account.user.id}>
                        <tr
                          className="cursor-pointer border-t border-gray-700 align-top transition-colors hover:bg-gray-800/40"
                          onClick={() => toggleUserExpanded(account)}
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
                            {getFullName(account.user)}
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {account.user.email ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {account.role ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-1 text-xs ${
                                account.user.emailVerified
                                  ? 'bg-emerald-500/10 text-emerald-300'
                                  : 'bg-amber-500/10 text-amber-300'
                              }`}
                            >
                              {account.user.emailVerified
                                ? 'Verified'
                                : 'Pending'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {formatDateTime(account.user.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            {formatDateTime(account.user.updatedAt)}
                          </td>
                          <td className="flex justify-center px-4 py-3 text-gray-300">
                            <button
                              type="button"
                              disabled={
                                deleteUserMutation.isPending ||
                                account.user.id === session?.user.id
                              }
                              onClick={(e) => {
                                e.stopPropagation()
                                onDeleteUserClick(account.user)
                              }}
                              className="cursor-pointer rounded-md border border-red-400/40 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <UserX size={14} />
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-t border-gray-700 bg-gray-900/40">
                            <td colSpan={8} className="px-4 py-4">
                              <UserDetailsPanel
                                account={account}
                                editFormData={editFormData}
                                isEditMode={isEditMode}
                                isPending={deleteUserMutation.isPending}
                                isSaving={updateUserMutation.isPending}
                                roleOptions={roleOptions}
                                onCancel={onCancelClick}
                                onEdit={onEditClick}
                                onEditFieldChange={onEditFieldChange}
                                onEditFileChange={handleEditFileChange}
                                onDeleteUser={onDeleteUserClick}
                                onRemoveImage={onRemoveImage}
                                onResetPassword={onResetPasswordClick}
                                onSave={onSaveClick}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-2 space-y-3 md:hidden">
              {filteredUsers.map((account) => {
                const isExpanded = editingUserData?.id === account.user.id

                return (
                  <article
                    key={account.user.id}
                    className="overflow-hidden rounded-xl border border-gray-700 bg-gray-900/60 shadow-xl shadow-black/10"
                  >
                    <button
                      type="button"
                      onClick={() => toggleUserExpanded(account)}
                      className="w-full p-4 text-left transition-colors hover:bg-gray-800/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-lg font-semibold leading-tight">
                            {getFullName(account.user)}
                          </h2>
                          <p className="mt-2 truncate text-sm text-gray-300">
                            {account.user.email ?? '—'}
                          </p>
                        </div>
                        <span
                          className={`inline-flex shrink-0 transform text-gray-400 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        >
                          ▼
                        </span>
                      </div>

                      {!isExpanded && (
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-300">
                          <p>
                            <span className="font-medium text-gray-100">
                              Role:
                            </span>{' '}
                            {account.role ?? '—'}
                          </p>
                          <p>
                            <span className="font-medium text-gray-100">
                              Created:
                            </span>{' '}
                            {formatDate(account.user.createdAt)}
                          </p>
                        </div>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-700 bg-gray-900/40 p-4">
                        <UserDetailsPanel
                          account={account}
                          editFormData={editFormData}
                          isEditMode={isEditMode}
                          isPending={deleteUserMutation.isPending}
                          isSaving={updateUserMutation.isPending}
                          roleOptions={roleOptions}
                          onCancel={onCancelClick}
                          onEdit={onEditClick}
                          onEditFieldChange={onEditFieldChange}
                          onEditFileChange={handleEditFileChange}
                          onDeleteUser={onDeleteUserClick}
                          onRemoveImage={onRemoveImage}
                          onResetPassword={onResetPasswordClick}
                          onSave={onSaveClick}
                        />
                      </div>
                    )}
                  </article>
                )
              })}
            </div>

            {filteredUsers.length === 0 && (
              <StatusMessage>
                No users match your current search. Try another name, role, or
                permission.
              </StatusMessage>
            )}

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={fetchMoreUsers}
                disabled={!hasNextPage || isFetchingNextPage}
                className="rounded-md border border-cyan-500/60 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isFetchingNextPage
                  ? 'Loading more…'
                  : hasNextPage
                    ? 'Load more users'
                    : 'No more users'}
              </button>
            </div>
          </div>
        )}
      </div>

      {passwordReset.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl shadow-black/30">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Reset Password
                </h2>
                <p className="text-xs text-gray-400">
                  Set a new temporary password for this user.
                </p>
              </div>
              <button
                type="button"
                onClick={onPasswordResetCancel}
                className="text-gray-400 transition-colors hover:text-gray-300"
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
              <label className="mb-2 block text-sm font-medium text-gray-300">
                New password
              </label>
              <input
                type="password"
                {...resetPasswordRegister('password')}
                placeholder="Enter new password"
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none transition-colors focus:border-cyan-500"
              />
              <FormError message={resetPasswordErrors.password?.message} />
            </div>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Confirm password
              </label>
              <input
                type="password"
                {...resetPasswordRegister('confirmPassword')}
                placeholder="Enter confirm password"
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none transition-colors focus:border-cyan-500"
              />
              <FormError
                message={resetPasswordErrors.confirmPassword?.message}
              />
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
                className="flex-1 rounded-md border border-gray-600 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={resetPasswordHandleSubmit(onPasswordResetSubmit)}
                disabled={resetPasswordMutation.isPending}
                className="flex-1 rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resetPasswordMutation.isPending ? 'Resetting…' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteUser.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl shadow-black/30">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Delete User
                </h2>
                <p className="text-xs text-gray-400">
                  Permanently remove user account.
                </p>
              </div>
              <button
                type="button"
                onClick={onDeleteUserCancel}
                className="text-gray-400 transition-colors hover:text-gray-300"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {deleteUserMutation.isError && (
              <div className="mb-4 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {deleteUserMutation.error?.message ||
                  'Failed to delete user account'}
              </div>
            )}

            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Enter your password
              </label>
              <input
                type="password"
                {...deleteUserRegister('password')}
                placeholder="Enter your password"
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none transition-colors focus:border-cyan-500"
              />
              <FormError message={deleteUserErrors.password?.message} />
            </div>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-300">
                User Account
              </label>
              <input
                type="text"
                disabled
                value={deleteUser.user?.email ?? ''}
                {...deleteUserRegister('userId')}
                placeholder="User account"
                className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none transition-colors focus:border-cyan-500 disabled:opacity-60"
              />
              <FormError message={deleteUserErrors.userId?.message} />
              <p className="mt-2 text-xs text-gray-400">
                Must enter your password to verify your identity in performing a
                user account removal.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onDeleteUserCancel}
                disabled={deleteUserMutation.isPending}
                className="flex-1 rounded-md border border-gray-600 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={deleteUserHandleSubmit(onDeleteUserSubmit)}
                disabled={deleteUserMutation.isPending}
                className="flex-1 rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteUserMutation.isPending ? 'Removing' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
