import { ChangeEvent, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { z } from 'zod'

// types
const searchSchema = z
  .object({
    nextCursor: z
      .object({
        id: z.string(),
        createdAt: z.string(),
      })
      .optional(),
  })
  .optional()

type SearchQuery = z.infer<typeof searchSchema>

type TodosInput = {
  pageSize?: number
  orderBy?: 'asc' | 'desc'
}

type TFetchTodos = {
  pageParam: SearchQuery
  queryKey: [
    string,
    {
      baseUrl: string
      input?: TodosInput
    },
  ]
}

interface TodosNodes {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  userId: string
}

type TodosPage = {
  nodes: Array<TodosNodes>
  pageInfo: {
    hasNextPage: boolean
    nextCursor: {
      id: string
      createdAt: string
    }
    totalPages: number
  }
  totalCount: number
}

interface TodosStatus extends TodosNodes {
  checked: boolean
}

async function getTodos({ pageParam, queryKey }: TFetchTodos) {
  const [, { baseUrl, input }] = queryKey

  const response = await fetch(
    `${baseUrl}?pageSize=${input?.pageSize ?? 10}&orderBy=${input?.orderBy ?? 'asc'}${pageParam?.nextCursor ? `&id=${pageParam.nextCursor.id}` : ''}${pageParam?.nextCursor ? `&createdAt=${JSON.stringify(pageParam.nextCursor.createdAt)}` : ''}`,
    {
      credentials: 'include',
    },
  )

  const data: TodosPage = await response.json()
  return data
}

export const Route = createFileRoute('/demo/drizzle')({
  component: DemoDrizzle,
})

function DemoDrizzle() {
  const queryClient = useQueryClient()

  const [todos, setTodos] = useState<TodosStatus[]>([])

  const { data, fetchNextPage } = useInfiniteQuery<TodosPage, Error>({
    queryKey: [
      'todos',
      {
        baseUrl: 'http://localhost:3006/api/v1/todos',
        input: {
          pageSize: 10,
          orderBy: 'desc',
        },
      },
    ],
    queryFn: async ({ pageParam, queryKey }) =>
      await getTodos({
        pageParam: pageParam as SearchQuery,
        queryKey: queryKey as [
          string,
          {
            baseUrl: string
            input?: TodosInput
          },
        ],
      }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.pageInfo.hasNextPage) {
        return {
          nextCursor: lastPage.pageInfo.nextCursor,
        }
      }
    },
  })

  const deleteTodosMutation = useMutation({
    mutationFn: async ({ data }: { data: { ids: string[] } }) => {
      return await fetch('http://localhost:3006/api/v1/todos/delete', {
        method: 'DELETE',
        headers: {
          accept: '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['todos'] }),
      ])
    },
  })

  const handleCheckboxChange = (id: string) => {
    setTodos(
      todos.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item,
      ),
    )
  }

  const handleDeleteTodos = async () => {
    try {
      const todosChecked = todos.filter((item) => item.checked)
      const todosIdsToDelete = todosChecked.map((item) => item.id)
      await deleteTodosMutation.mutateAsync(
        { data: { ids: todosIdsToDelete } },
        {
          onSuccess: async (response) => {
            if (response.ok) {
              const result = (await response.json()) as {
                message: string
                deletedItems: {
                  id: string
                  title: string
                }[]
              }
              console.log('🚀 ~ handleDeleteTodos ~ result:', result.message)
            }
          },
          onError: (error) => {
            console.log('🚀 ~ handleDeleteTodos ~ error:', error.message)
          },
        },
      )
    } catch (error) {
      console.log('🚀 ~ handleDeleteTodos ~ error:', error)
    }
  }

  const handleSelectAll = (
    e: ChangeEvent<HTMLInputElement, HTMLInputElement>,
  ) => {
    const isChecked = e.target.checked
    setTodos(todos.map((item) => ({ ...item, checked: isChecked })))
  }

  useEffect(() => {
    if (!data || Object.keys(data).length === 0) return

    const nodes = data.pages.flatMap((item) => item.nodes)

    if (Array.isArray(nodes) && nodes.length > 0) {
      setTodos(nodes.map((item) => ({ ...item, checked: false })))
    } else {
      setTodos([])
    }
  }, [data])

  const selectedCount = todos.filter((item) => item.checked).length
  const isAllSelected = selectedCount === todos.length && todos.length > 0

  return (
    <div
      className="flex justify-center min-h-screen p-6 text-white"
      style={{
        background:
          'linear-gradient(135deg, #0c1a2b 0%, #1a2332 50%, #16202e 100%)',
      }}
    >
      <div className="w-full max-w-4xl">
        <div
          className="rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
          style={{
            background:
              'linear-gradient(135deg, rgba(22, 32, 46, 0.95) 0%, rgba(12, 26, 43, 0.95) 100%)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div className="p-8 border-b border-white/10">
            <h2 className="text-3xl font-bold text-indigo-300">Todos</h2>
            <p className="text-gray-400 text-sm mt-2">
              Manage your tasks efficiently
            </p>
          </div>

          {/* Selection Button/Indicator */}
          {selectedCount > 0 && (
            <div className="px-8 pt-6 pb-4">
              <div className="flex items-center gap-3 bg-indigo-500/20 border border-indigo-500/30 rounded-lg p-4">
                <span className="text-sm font-medium text-indigo-200">
                  {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
                </span>
                <button
                  className="ml-auto bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
                  onClick={handleDeleteTodos}
                >
                  Delete Todo/s
                </button>
              </div>
            </div>
          )}

          {/* Table Structure */}
          <div className="overflow-x-auto px-8 pb-8">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-4 text-left">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={isAllSelected}
                      className="w-5 h-5 rounded border-white/30 bg-white/10 text-indigo-600 cursor-pointer accent-indigo-600"
                      aria-label="Select all rows"
                    />
                  </th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-indigo-200 uppercase tracking-wide">
                    Title
                  </th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-indigo-200 uppercase tracking-wide">
                    Created At
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {todos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-12 text-center text-gray-400"
                    >
                      No todos yet. Start by creating one!
                    </td>
                  </tr>
                ) : (
                  todos.map((item) => (
                    <tr
                      key={item.id}
                      className={`transition-colors duration-150 ${
                        item.checked
                          ? 'bg-indigo-600/20 border-indigo-500/30'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => handleCheckboxChange(item.id)}
                          className="w-5 h-5 rounded border-white/30 bg-white/10 text-indigo-600 cursor-pointer accent-indigo-600"
                          aria-label={`Select item ${item.title}`}
                        />
                      </td>
                      <td className="px-4 py-4 font-medium text-white">
                        {item.title}
                      </td>
                      <td className="px-4 py-4 text-gray-400 text-sm">
                        {new Date(item.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {data?.pages &&
              data.pages[data.pages.length - 1]?.pageInfo?.hasNextPage && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => fetchNextPage()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors duration-200"
                  >
                    Load More
                  </button>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  )
}
