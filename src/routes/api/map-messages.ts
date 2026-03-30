import { createFileRoute } from '@tanstack/react-router'
import { and, desc, eq, isNotNull, inArray, gt } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/db'
import { session, todos, user } from '@/db/schema'

const createMapMessageSchema = z.object({
  mapMessage: z.string().trim().min(1).max(140),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

function parseCookieHeader(
  cookieHeader: string | null,
): Record<string, string> {
  if (!cookieHeader) return {}

  return cookieHeader
    .split(';')
    .map((cookiePart) => cookiePart.trim())
    .reduce<Record<string, string>>((acc, cookiePart) => {
      const [rawName, ...valueParts] = cookiePart.split('=')
      if (!rawName || valueParts.length === 0) return acc

      acc[rawName] = decodeURIComponent(valueParts.join('='))
      return acc
    }, {})
}

async function getAuthenticatedUserId(request: Request) {
  const cookies = parseCookieHeader(request.headers.get('cookie'))

  const authTokenCandidates = Object.entries(cookies)
    .filter(([cookieName]) => cookieName.toLowerCase().includes('session'))
    .map(([, cookieValue]) => cookieValue)

  if (authTokenCandidates.length === 0) return null

  const [activeSession] = await db
    .select({
      userId: session.userId,
    })
    .from(session)
    .where(
      and(
        inArray(session.token, authTokenCandidates),
        gt(session.expiresAt, new Date()),
      ),
    )
    .limit(1)

  return activeSession?.userId ?? null
}

export const Route = createFileRoute('/api/map-messages')({
  server: {
    handlers: {
      GET: async () => {
        const rows = await db
          .select({
            id: todos.id,
            title: todos.title,
            latitude: todos.latitude,
            longitude: todos.longitude,
            createdAt: todos.createdAt,
            userId: todos.userId,
          })
          .from(todos)
          .where(and(isNotNull(todos.latitude), isNotNull(todos.longitude)))
          .orderBy(desc(todos.createdAt))

        return Response.json(
          rows.map((row) => ({
            id: row.id,
            title: row.title,
            mapMessage: row.title,
            latitude: row.latitude,
            longitude: row.longitude,
            createdAt: row.createdAt,
            userId: row.userId,
          })),
        )
      },
      POST: async ({ request }) => {
        const userId = await getAuthenticatedUserId(request)

        if (!userId) {
          return Response.json(
            { error: 'Authentication required to create map messages.' },
            { status: 401 },
          )
        }

        const payload = await request.json().catch(() => null)
        const parsedPayload = createMapMessageSchema.safeParse(payload)

        if (!parsedPayload.success) {
          return Response.json(
            {
              error: 'Invalid map message payload.',
              details: parsedPayload.error.flatten(),
            },
            { status: 400 },
          )
        }

        const [existingUser] = await db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.id, userId))
          .limit(1)

        if (!existingUser) {
          return Response.json(
            { error: 'Authenticated user was not found.' },
            { status: 403 },
          )
        }

        const [createdRow] = await db
          .insert(todos)
          .values({
            title: parsedPayload.data.mapMessage,
            userId,
            latitude: parsedPayload.data.latitude,
            longitude: parsedPayload.data.longitude,
          })
          .returning({
            id: todos.id,
            title: todos.title,
            latitude: todos.latitude,
            longitude: todos.longitude,
            createdAt: todos.createdAt,
            userId: todos.userId,
          })

        return Response.json(
          {
            id: createdRow.id,
            title: createdRow.title,
            mapMessage: createdRow.title,
            latitude: createdRow.latitude,
            longitude: createdRow.longitude,
            createdAt: createdRow.createdAt,
            userId: createdRow.userId,
          },
          { status: 201 },
        )
      },
    },
  },
})
