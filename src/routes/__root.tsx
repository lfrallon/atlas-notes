import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  isRedirect,
  redirect,
} from '@tanstack/react-router'

import Header from '../components/Header'

import appCss from '../styles.css?url'

// auth provider
import { AuthProvider } from '@/auth'

// server functions
import { getSession } from '@/server'

// types
import type { QueryClient } from '@tanstack/react-query'
import type { Session, User } from '@/lib/auth-client'

interface AuthState {
  isAuthenticated: boolean
  user: User | null
  hasRole: (role: string) => boolean
  hasAnyRole: (roles: string[]) => boolean
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export interface RouterContext {
  auth: AuthState | null
  queryClient: QueryClient
  session?: Session | null
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  beforeLoad: async ({ context, location }) => {
    try {
      const data = await getSession(context.queryClient)

      // if (!data) {
      //   console.log('🚀 ~ data:', data)
      //   // throw redirect({ to: '/' })
      // }

      return {
        session: data?.session,
      }
    } catch (error) {
      if (isRedirect(error)) throw error

      // When offline/unreachable, still allow public and offline routes to load.
      throw redirect({ to: '/' })
    }
  },
  component: RootComponent,
  notFoundComponent: () => {
    return <div>Not Found!</div>
  },
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Header />
        <AuthProvider>{children}</AuthProvider>
        <Scripts />
      </body>
    </html>
  )
}
