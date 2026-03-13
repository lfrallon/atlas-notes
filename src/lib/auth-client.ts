import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: 'http://localhost:3006',
  plugins: [
    inferAdditionalFields({
      user: {
        roles: {
          type: 'string[]',
          required: true,
        },
        permissions: {
          type: 'string[]',
          required: true,
        },
      },
    }),
  ],
})

export type User = typeof authClient.$Infer.Session.user
export type Session = typeof authClient.$Infer.Session
