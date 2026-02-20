import { ChangeEvent, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { z } from 'zod'
import { Trash } from 'lucide-react'

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
      return await fetch('http://localhost:3006/api/v1/todos', {
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

  const handleDeleteTodo = async (id: string) => {
    try {
      await deleteTodosMutation.mutateAsync(
        { data: { ids: [id] } },
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
              console.log('🚀 ~ handleDeleteTodo ~ result:', result.message)
            }
          },
          onError: (error) => {
            console.log('🚀 ~ handleDeleteTodo ~ error:', error.message)
          },
        },
      )
    } catch (error) {
      console.log('🚀 ~ handleDeleteTodo ~ error:', error)
    }
  }

  const handleSelectAll = (
    e: ChangeEvent<HTMLInputElement, HTMLInputElement>,
  ) => {
    if (todos.length === 0) return
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
      className="flex justify-center min-h-screen p-3 sm:p-6 text-white"
      style={{
        background:
          'linear-gradient(135deg, #0c1a2b 0%, #1a2332 50%, #16202e 100%)',
      }}
    >
      <div className="w-full">
        <div
          className="rounded-xl sm:rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
          style={{
            background:
              'linear-gradient(135deg, rgba(22, 32, 46, 0.95) 0%, rgba(12, 26, 43, 0.95) 100%)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div className="p-4 sm:p-8 border-b border-white/10">
            <h2 className="text-2xl sm:text-2xl font-bold text-indigo-300">
              TODOS
            </h2>
            <p className="text-gray-400 text-xs sm:text-sm mt-2">
              Manage your tasks efficiently
            </p>
          </div>

          {/* Selection Button/Indicator */}
          {selectedCount > 0 && (
            <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-3 sm:pb-4 animate-in fade-in slide-in-from-top-2 duration-600">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 bg-linear-to-r from-indigo-600/30 to-purple-600/20 border border-indigo-400/50 rounded-lg sm:rounded-xl p-4 sm:p-5 shadow-lg shadow-indigo-500/10 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-bold">
                    {selectedCount}
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-indigo-100">
                    item{selectedCount !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <button
                  className="sm:ml-auto w-full sm:w-auto ring-1 ring-red-400 hover:ring-red-300 text-indigo-200 font-normal py-2 px-4 sm:px-6 rounded-lg transition-all duration-200 shadow-sm shadow-red-600/30 hover:shadow-red-600/50 active:scale-95 text-sm hover:cursor-pointer"
                  onClick={handleDeleteTodos}
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          {/* Table Structure */}
          <div className="overflow-x-auto px-4 sm:px-8 pb-6 sm:pb-8">
            <table className="w-full text-sm sm:text-base">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-2 sm:px-4 py-3 sm:py-4 text-left">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={isAllSelected}
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded border-white/30 bg-white/10 text-indigo-600 cursor-pointer accent-indigo-600"
                      aria-label="Select all rows"
                    />
                  </th>
                  <th className="px-2 sm:px-4 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-indigo-200 uppercase tracking-wide">
                    NO.
                  </th>
                  <th className="px-2 sm:px-4 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-indigo-200 uppercase tracking-wide">
                    Title
                  </th>
                  <th className="hidden sm:table-cell px-2 sm:px-4 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-indigo-200 uppercase tracking-wide">
                    Created At
                  </th>
                  <th className="px-2 sm:px-4 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold text-indigo-200 uppercase tracking-wide">
                    Remove
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {todos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-2 sm:px-4 py-8 sm:py-12 text-center text-gray-400 text-sm"
                    >
                      No todos yet. Start by creating one!
                    </td>
                  </tr>
                ) : (
                  todos.map((item, index) => (
                    <tr
                      key={item.id}
                      className={`transition-colors duration-150 ${
                        item.checked
                          ? 'bg-indigo-600/20 border-indigo-500/30'
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <td className="px-2 sm:px-4 py-3 sm:py-4">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => handleCheckboxChange(item.id)}
                          className="w-4 h-4 sm:w-5 sm:h-5 rounded border-white/30 bg-white/10 text-indigo-600 cursor-pointer accent-indigo-600"
                          aria-label={`Select item ${item.title}`}
                        />
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 font-medium text-white text-xs sm:text-base wrap-break-word">
                        {index + 1}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 font-medium text-white text-xs sm:text-base wrap-break-word">
                        {item.title}
                      </td>
                      <td className="hidden sm:table-cell px-2 sm:px-4 py-3 sm:py-4 text-gray-400 text-xs sm:text-sm">
                        {new Date(item.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="flex flex-1 justify-center items-center px-2 sm:px-4 py-3 sm:py-4 text-gray-400 text-xs sm:text-sm">
                        <button
                          onClick={() => handleDeleteTodo(item.id)}
                          className="text-red-400 hover:text-red-300 transition-colors hover:cursor-pointer"
                        >
                          <Trash size={18} className="sm:w-5 sm:h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {data?.pages &&
              data.pages[data.pages.length - 1]?.pageInfo?.hasNextPage && (
                <div className="flex justify-center mt-6 sm:mt-8">
                  <button
                    onClick={() => fetchNextPage()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 sm:px-6 rounded-lg transition-colors duration-200 text-sm sm:text-base"
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
