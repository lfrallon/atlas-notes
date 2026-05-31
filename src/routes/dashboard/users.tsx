import { createFileRoute } from '@tanstack/react-router'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import z from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

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

interface CreateUserForm {
  firstName: string
  lastName: string
  email: string
  password: string
  roleId: string
  image: string | null
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

  const [search, setSearch] = useState('')
  const [isOnSubmit, setIsOnSubmit] = useState(false)
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    roleId: '',
    image: null,
  })

  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateUserInputs>({
    resolver: zodResolver(createUserSchema),
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
      setCreateForm({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        roleId: '',
        image: null,
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
            baseUrl: `${USER_API_BASE_URL}/accounts`,
            input: {
              pageSize: 10,
              orderBy: 'desc',
            },
          },
        ],
      })
    },
  })

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCreateForm((previous) => ({
      ...previous,
      image: null,
    }))

    const file = event.target.files?.[0]
    if (file) {
      // Show preview before uploading
      setCreateForm((previous) => ({
        ...previous,
        image: URL.createObjectURL(file),
      }))
    }

    setValue('image', file, {
      shouldValidate: true,
    })
  }

  const onCreateUser: SubmitHandler<CreateUserInputs> = async (data) => {
    console.log('🚀 ~ onCreateUser ~ data:', data)

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

  console.log('errors: ', errors)

  // const permissionOptions = useMemo(() => {
  //   return Array.from(
  //     new Set(roleOptions.flatMap((role) => role.permissions)),
  //   ).sort()
  // }, [roleOptions])

  // const togglePermission = (permission: string) => {
  //   setCreateForm((previous) => ({
  //     ...previous,
  //     permissions: previous.permissions.includes(permission)
  //       ? previous.permissions.filter((value) => value !== permission)
  //       : [...previous.permissions, permission],
  //   }))
  // }

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
          {/* <div className="mt-3">
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
          </div> */}
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              onClick={handleSubmit(onCreateUser)}
              disabled={createUserMutation.isPending || isOnSubmit}
              style={{
                cursor: isOnSubmit ? 'not-allowed' : 'pointer',
              }}
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
                            placeholder="e.g. todos:read,geo-notes:update"
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
                      placeholder="e.g. todos:read,geo-notes:update"
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
