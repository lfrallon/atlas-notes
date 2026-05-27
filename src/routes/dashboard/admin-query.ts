import { z } from 'zod'

export const cursorSchema = z
  .object({
    nextCursor: z
      .object({
        id: z.string(),
        updatedAt: z.string(),
      })
      .optional(),
  })
  .optional()

export type CursorQuery = z.infer<typeof cursorSchema>

export type PaginationInput = {
  pageSize?: number
  orderBy?: 'asc' | 'desc'
  limit?: number
}

export function buildCursorPaginationQuery(
  input: PaginationInput | undefined,
  pageParam: CursorQuery,
): string {
  const searchParams = new URLSearchParams({
    pageSize: String(input?.pageSize ?? 10),
    orderBy: input?.orderBy ?? 'asc',
    limit: String(input?.limit ?? 200),
  })

  if (pageParam?.nextCursor) {
    searchParams.set('id', pageParam.nextCursor.id)
    searchParams.set(
      'updatedAt',
      JSON.stringify(pageParam.nextCursor.updatedAt),
    )
  }

  return searchParams.toString()
}
