import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { roles } from '@/utils/auth'

type AdminUser = {
  id: string
  name: string | null
  email: string | null
  role: string | null
  scope: string | null
  createdAt: string | null
  updatedAt: string | null
}

type UsersResponse = {
  users: AdminUser[]
}

const USER_API_BASE_URL =
  import.meta.env.VITE_FASTIFY_API_URL ?? 'http://localhost:3006/api/v1'

export const Route = createFileRoute('/admin/users')({
  beforeLoad: ({ context }) => {
    const role = context.session?.user?.roleId

    if (!role || role !== roles.ADMIN) {
      throw redirect({ to: '/' })
    }
  },
  component: AdminUsersPage,
})

async function fetchUsers() {
  const response = await fetch(`${USER_API_BASE_URL}/user`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Failed to load users')
  }

  const data = (await response.json()) as UsersResponse | AdminUser[]

  if (Array.isArray(data)) {
    return data
  }

  return data.users
}

function AdminUsersPage() {
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()

  const usersQuery = useQuery({
    queryKey: ['adminUsers', { baseUrl: USER_API_BASE_URL }],
    queryFn: fetchUsers,
  })

  const updateScopeMutation = useMutation({
    mutationFn: async ({ userId, scope }: { userId: string; scope: string }) => {
      const response = await fetch(`${USER_API_BASE_URL}/user/${userId}/scope`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ scope }),
      })

      if (!response.ok) {
        throw new Error('Failed to update operational scope')
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['adminUsers'] })
    },
  })

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase()
    const users = usersQuery.data ?? []

    if (!term) return users

    return users.filter((user) => {
      return [user.name, user.email, user.role, user.scope]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(term))
    })
  }, [search, usersQuery.data])

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8 text-gray-100">
      <h1 className="text-3xl font-bold">Admin • User Management</h1>
      <p className="mt-2 text-sm text-gray-300">
        View all users and assign each user an operational scope used by the
        backend user API.
      </p>

      <div className="mt-6 rounded-lg border border-gray-700 bg-gray-900/60 p-4">
        <label htmlFor="search-users" className="mb-2 block text-sm font-medium">
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

      {usersQuery.isLoading && <p className="mt-4 text-sm">Loading users…</p>}
      {usersQuery.isError && (
        <p className="mt-4 text-sm text-red-400">
          Could not load users. Check your API connection and admin session.
        </p>
      )}

      {usersQuery.isSuccess && (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-700">
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
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-t border-gray-700 align-top">
                  <td className="px-4 py-3">{user.name ?? '—'}</td>
                  <td className="px-4 py-3">{user.email ?? '—'}</td>
                  <td className="px-4 py-3">{user.role ?? '—'}</td>
                  <td className="px-4 py-3">
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(event) => {
                        event.preventDefault()

                        const formData = new FormData(event.currentTarget)
                        const scope = String(formData.get('scope') ?? '').trim()

                        void updateScopeMutation.mutateAsync({
                          userId: user.id,
                          scope,
                        })
                      }}
                    >
                      <input
                        name="scope"
                        defaultValue={user.scope ?? ''}
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
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
