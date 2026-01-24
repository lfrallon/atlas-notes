import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '../db/index.ts'
import * as schema from '../db/schema/index.ts'

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: ['http://localhost:3000'],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 7 * 24 * 60 * 60, // 7 days cache duration
      strategy: 'jwe', // can be "jwt" or "compact"
      refreshCache: true, // Enable stateless refresh
    },
  },
  account: {
    storeStateStrategy: 'cookie',
    storeAccountCookie: true, // Store account data after OAuth flow in a cookie (useful for database-less flows)
  },
  database: drizzleAdapter(db, {
    provider: 'pg', // or "pg" or "mysql"
    schema,
  }),
})
