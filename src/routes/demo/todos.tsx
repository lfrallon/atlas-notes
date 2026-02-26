import { ChangeEvent, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { z } from 'zod'
import { CircleX, Trash, CheckCircle, XCircle, Trash2 } from 'lucide-react'

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
  completed: boolean
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

export const Route = createFileRoute('/demo/todos')({
  component: DemoDrizzle,
})

function DemoDrizzle() {
  const queryClient = useQueryClient()

  const [todo, setTodo] = useState('')
  const [todos, setTodos] = useState<TodosStatus[]>([])

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery<TodosPage, Error>({
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

  const addTodosMutation = useMutation({
    mutationFn: async ({
      data,
    }: {
      data: {
        title: string
      }
    }) =>
      fetch(`http://localhost:3006/api/v1/todos/add`, {
        method: 'POST',
        headers: {
          accept: '*/*',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['todos'] }),
      ])
    },
  })

  const updateTodosMutation = useMutation({
    mutationFn: async ({
      data,
    }: {
      data: { id: string; title?: string; completed?: boolean }[]
    }) => {
      return await fetch('http://localhost:3006/api/v1/todos/update', {
        method: 'PUT',
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

  const submitTodo = async () => {
    try {
      addTodosMutation.mutateAsync(
        { data: { title: todo } },
        {
          onSuccess: (data) => {
            console.log('🚀 ~ submitTodo ~ data:', data)
            setTodo('')
          },
          onError: (error) => {
            console.log('🚀 ~ submitTodo ~ error:', error.message)
          },
        },
      )
    } catch (error) {
      console.log('🚀 ~ submitTodo ~ error:', error)
      setTodo('')
    }
  }

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

  const handleUpdateTodo = async (id: string, completed: boolean) => {
    try {
      await updateTodosMutation.mutateAsync(
        { data: [{ id, completed }] },
        {
          onSuccess: async (response) => {
            if (response.ok) {
              const result = (await response.json()) as {
                message: string
                updatedItems: {
                  id: string
                  title: string
                  completed: boolean
                }[]
              }
              console.log('🚀 ~ handleUpdateTodo ~ result:', result.message)
            }
          },
          onError: (error) => {
            console.log('🚀 ~ handleUpdateTodo ~ error:', error.message)
          },
        },
      )
    } catch (error) {
      console.log('🚀 ~ handleUpdateTodo ~ error:', error)
    }
  }

  const handleUpdateAllTodos = async (value: boolean) => {
    try {
      const todosFiltered = todos.filter(
        (item) => item.completed !== value && item.checked,
      )
      const todosToUpdate = todosFiltered.map((item) => ({
        id: item.id,
        completed: value,
      }))
      await updateTodosMutation.mutateAsync({ data: todosToUpdate })
    } catch (error) {
      console.log('🚀 ~ handleUpdateAllTodos ~ error:', error)
    }
  }

  const handleSelectAll = (
    e: ChangeEvent<HTMLInputElement, HTMLInputElement>,
  ) => {
    if (todos.length === 0) return
    const isChecked = e.target.checked
    setTodos(todos.map((item) => ({ ...item, checked: isChecked })))
  }

  const fetchMoreTodos = async () => {
    if (hasNextPage && !isFetchingNextPage) {
      try {
        await fetchNextPage()
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : JSON.stringify(error)
        console.log('🚀 ~ fetchMoreTodos ~ errorMessage:', errorMessage)
      }
    }
  }

  useEffect(() => {
    if (!data || Object.keys(data).length === 0) return

    if ('error' in data.pages[0]) {
      setTodos([])
      return
    }

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
      className="min-h-screen text-white gap-6"
      style={{
        background:
          'linear-gradient(135deg, #0c1a2b 0%, #1a2332 50%, #16202e 100%)',
      }}
    >
      <div className="sticky top-18 z-40 w-full p-3 sm:p-6 backdrop-blur-md bg-black/50 shadow-xl">
        <div className="flex gap-2">
          <input
            type="text"
            value={todo}
            onChange={(e) => setTodo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                submitTodo()
              }
            }}
            placeholder="Enter a new todo..."
            className="flex-1 px-4 py-3 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          />
          <button
            disabled={todo.trim().length === 0}
            onClick={submitTodo}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            Add todo
          </button>
        </div>
      </div>

      {/* Selection Button/Indicator */}
      {selectedCount > 0 && (
        <div className="sticky top-13.5 sm:top-14.5 z-40 sm:px-6 pt-3 sm:pt-6 animate-in fade-in slide-in-from-top-2 duration-600">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 bg-linear-to-r from-indigo-600/30 to-purple-600/20 sm:border sm:border-indigo-400/50 sm:rounded-2xl p-4 sm:p-5 shadow-lg shadow-indigo-500/10 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-bold">
                {selectedCount}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-indigo-100">
                item{selectedCount !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="sm:ml-auto w-full sm:w-auto gap-4 shrink-0 flex">
              <button
                className="sm:ml-auto w-full sm:w-auto ring-1 ring-green-400 hover:ring-green-300 hover:text-green-300 text-green-400 bg-green-600/20 font-normal py-2 px-4 sm:px-6 rounded-lg transition-all duration-200 shadow-sm shadow-green-600/30 hover:shadow-green-600/50 active:scale-95 text-sm hover:cursor-pointer"
                onClick={() => handleUpdateAllTodos(true)}
              >
                <div className="flex items-center justify-center">
                  <CheckCircle size={16} className="inline-block mr-2" />
                  <div className="hidden lg:inline">Mark complete</div>
                </div>
              </button>
              <button
                className="sm:ml-auto w-full sm:w-auto ring-1 ring-orange-400 hover:ring-orange-300 hover:text-orange-300 text-orange-400 bg-orange-600/20 font-normal py-2 px-4 sm:px-6 rounded-lg transition-all duration-200 shadow-sm shadow-orange-600/30 hover:shadow-orange-600/50 active:scale-95 text-sm hover:cursor-pointer"
                onClick={() => handleUpdateAllTodos(false)}
              >
                <div className="flex items-center justify-center">
                  <XCircle size={16} className="inline-block mr-2" />
                  <div className="hidden lg:inline">Mark incomplete</div>
                </div>
              </button>
              <button
                className="sm:ml-auto w-full sm:w-auto ring-1 ring-red-400 hover:ring-red-300 hover:text-red-300 text-red-400 bg-red-600/20 font-normal py-2 px-4 sm:px-6 rounded-lg transition-all duration-200 shadow-sm shadow-red-600/30 hover:shadow-red-600/50 active:scale-95 text-sm hover:cursor-pointer"
                onClick={handleDeleteTodos}
              >
                <div className="flex items-center justify-center">
                  <Trash2 size={16} className="inline-block mr-2" />
                  <div className="hidden lg:inline">Delete</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full p-3 sm:p-6">
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
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded border-indigo-500/50 bg-indigo-600/20 text-indigo-400 cursor-pointer accent-indigo-400 hover:bg-indigo-600/40 transition-colors"
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
                  <th className="hidden sm:table-cell px-2 sm:px-4 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-indigo-200 uppercase tracking-wide">
                    Updated At
                  </th>
                  <th className="px-2 sm:px-4 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold text-indigo-200 uppercase tracking-wide">
                    Completed
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
                      colSpan={6}
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
                          className="w-4 h-4 sm:w-5 sm:h-5 rounded border-indigo-500/50 bg-indigo-600/20 text-indigo-400 cursor-pointer accent-indigo-400 hover:bg-indigo-600/40 transition-colors"
                          aria-label={`Select item ${item.title}`}
                        />
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 font-medium text-white text-xs sm:text-base wrap-break-word">
                        {index + 1}
                      </td>
                      <td
                        className={`px-2 sm:px-4 py-3 sm:py-4 font-medium text-white text-xs sm:text-base wrap-break-word ${item.completed ? 'opacity-70 line-through' : ''}`}
                      >
                        {item.title}
                      </td>
                      <td className="hidden sm:table-cell px-2 sm:px-4 py-3 sm:py-4 text-gray-400 text-xs sm:text-sm">
                        {new Date(item.createdAt).toLocaleDateString('en-PH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="hidden sm:table-cell px-2 sm:px-4 py-3 sm:py-4 text-gray-400 text-xs sm:text-sm">
                        {new Date(item.updatedAt).toLocaleDateString('en-PH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-gray-400 text-xs sm:text-sm">
                        <div className="flex justify-center items-center">
                          {item.completed ? (
                            <div className="inline-flex items-center gap-1 px-2 py-1">
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-green-400 bg-green-600/20 text-xs">
                                Completed
                              </span>
                              <span className="inline-flex justify-center items-center px-2 py-1 text-xs">
                                <button
                                  onClick={() =>
                                    handleUpdateTodo(item.id, false)
                                  }
                                  className="text-red-400 hover:text-red-300 transition-colors hover:cursor-pointer"
                                >
                                  <CircleX size={16} />
                                </button>
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex justify-center items-center gap-1 px-2 py-1 rounded-full text-orange-400 bg-orange-600/20 text-xs">
                              <button
                                onClick={() => handleUpdateTodo(item.id, true)}
                                className="text-orange-400 hover:text-orange-300 transition-colors hover:cursor-pointer"
                              >
                                Mark as completed
                              </button>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-gray-400 text-xs sm:text-sm">
                        <span className="flex justify-center items-center gap-1 px-2 py-1 text-xs">
                          <button
                            onClick={() => handleDeleteTodo(item.id)}
                            className="text-red-400 hover:text-red-300 transition-colors hover:cursor-pointer"
                          >
                            <Trash size={18} className="sm:w-5 sm:h-5" />
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {data?.pages &&
              data.pages[data.pages.length - 1]?.pageInfo?.hasNextPage && (
                <div className="flex justify-center mt-6 sm:mt-8">
                  <span className="inline-flex justify-center items-center gap-1 px-3 py-2 rounded-full text-orange-400 bg-orange-600/20 text-xs">
                    <button
                      onClick={fetchMoreTodos}
                      className="text-orange-400 hover:text-orange-300 transition-colors hover:cursor-pointer"
                    >
                      Load More
                    </button>
                  </span>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  )
}
