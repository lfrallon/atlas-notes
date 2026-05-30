import { queryOptions, useQuery } from '@tanstack/react-query'

type TFetchUserAccess = {
  queryKey: [
    string,
    {
      baseUrl: string
    },
  ]
}

type UserAccessPage = {
  id: string | null
  role: string | null
  permissions: string[]
}

const USER_ACCESS_API_BASE_URL =
  import.meta.env.VITE_FASTIFY_API_URL ?? 'http://localhost:3006/api/v1'

async function getUserAccess({ queryKey }: TFetchUserAccess) {
  const [, { baseUrl }] = queryKey

  const response = await fetch(`${baseUrl}/user/access`, {
    credentials: 'include',
  })

  const data: UserAccessPage = await response.json()
  return data
}

export function useUserAccess() {
  const userAccessOptions = queryOptions<UserAccessPage, Error>({
    queryKey: ['userAccess', { baseUrl: USER_ACCESS_API_BASE_URL }],
    queryFn: async ({ queryKey }) =>
      await getUserAccess({
        queryKey: queryKey as [
          string,
          {
            baseUrl: string
          },
        ],
      }),
  })

  return useQuery(userAccessOptions)
}
