// src/auth.tsx
import React, { createContext, useContext, useState } from 'react'

// libs
import { authClient, type User } from './lib/auth-client'

interface AuthState {
  isAuthenticated: boolean
  user: User | null
  hasRole: (role: string) => boolean
  hasAnyRole: (roles: string[]) => boolean
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const hasRole = (role: string) => {
    return user?.roles.includes(role) ?? false
  }

  const hasAnyRole = (roles: string[]) => {
    return roles.some((role) => user?.roles.includes(role)) ?? false
  }

  const hasPermission = (permission: string) => {
    return user?.permissions.includes(permission) ?? false
  }

  const hasAnyPermission = (permissions: string[]) => {
    return (
      permissions.some((permission) =>
        user?.permissions.includes(permission),
      ) ?? false
    )
  }

  const login = async (email: string, password: string) => {
    const response = await authClient.signIn.email({
      email,
      password,
      fetchOptions: {
        credentials: 'include',
      },
    })

    if (response && response.data) {
      setUser(response.data.user)
      setIsAuthenticated(true)
    } else {
      throw new Error('Authentication failed')
    }
  }

  const logout = async () => {
    await authClient.signOut()
    setUser(null)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        hasRole,
        hasAnyRole,
        hasPermission,
        hasAnyPermission,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
