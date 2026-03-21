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

// server functions
import { getSession } from '@/server'

// types
import type { QueryClient } from '@tanstack/react-query'
import type { Session } from '@/lib/auth-client'
import type { CSSProperties } from 'react'

export interface RouterContext {
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
  beforeLoad: async ({ context }) => {
    try {
      const data = await getSession(context.queryClient)

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
      <body
        style={
          {
            '--app-header-height': '4rem',
          } as CSSProperties
        }
      >
        <Header />
        {children}
        <Scripts />
      </body>
    </html>
  )
}
