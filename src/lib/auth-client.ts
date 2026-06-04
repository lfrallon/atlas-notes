import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: 'http://localhost:3006',
  plugins: [
    inferAdditionalFields({
      user: {
        firstName: { type: 'string', required: true },
        lastName: { type: 'string', required: true },
        roleId: {
          type: 'string',
          required: false,
          defaultValue: null,
        },
      },
    }),
  ],
})

export const { useSession } = authClient

export type User = typeof authClient.$Infer.Session.user
export type Session = typeof authClient.$Infer.Session
