import { createIsomorphicFn } from '@tanstack/react-start'

// lib
import { authClient } from '@/lib/auth-client'

// types
import type { RouterContext } from '@/routes/__root'

export const getSession = createIsomorphicFn().client(
  async (queryClient: RouterContext['queryClient']) => {
    const { data: session } = await queryClient.ensureQueryData({
      queryFn: () => authClient.getSession(),
      queryKey: ['auth', 'getUserSession'],
      staleTime: 60_000,
      revalidateIfStale: true,
    })

    return {
      session,
    }
  },
)
