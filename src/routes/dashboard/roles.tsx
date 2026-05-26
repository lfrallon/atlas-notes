import { useInfiniteQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

// types
import type { Permission } from '@/utils/auth'

const searchSchema = z
  .object({
    nextCursor: z
      .object({
        id: z.string(),
        updatedAt: z.string(),
      })
      .optional(),
  })
  .optional()

type SearchQuery = z.infer<typeof searchSchema>

type UserRolesInput = {
  pageSize?: number
  orderBy?: 'asc' | 'desc'
}

type TFetchUserRoles = {
  pageParam: SearchQuery
  queryKey: [
    string,
    {
      baseUrl: string
      input?: UserRolesInput
    },
  ]
}

type UserSelect = {
  id: string
  name: string
  email: string
  image: string | null
  emailVerified: boolean
  createdAt: string
  updatedAt: string
  roleId: string | null
}

interface UserRolesNodes {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  createdAt: string
  updatedAt: string
  users: UserSelect[]
  permissions: Permission[]
}

type UserRolesPage = {
  nodes: Array<UserRolesNodes>
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

async function getUserRoles({ pageParam, queryKey }: TFetchUserRoles) {
  const [, { baseUrl, input }] = queryKey

  const response = await fetch(
    `${baseUrl}?pageSize=${input?.pageSize ?? 10}&orderBy=${input?.orderBy ?? 'asc'}${pageParam?.nextCursor ? `&id=${pageParam.nextCursor.id}` : ''}${pageParam?.nextCursor ? `&updatedAt=${JSON.stringify(pageParam.nextCursor.updatedAt)}` : ''}`,
    {
      credentials: 'include',
    },
  )

  const data: UserRolesPage = await response.json()
  return data
}

const ROLE_API_BASE_URL =
  import.meta.env.VITE_FASTIFY_API_URL ?? 'http://localhost:3006/api/v1'

export const Route = createFileRoute('/dashboard/roles')({
  component: RouteComponent,
})

function RouteComponent() {
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
        },
      },
    ],
    queryFn: async ({ pageParam, queryKey }) =>
      await getUserRoles({
        pageParam: pageParam as SearchQuery,
        queryKey: queryKey as [
          string,
          {
            baseUrl: string
            input?: UserRolesInput
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

  return <div>Hello "/dashboard/roles"!</div>
}
