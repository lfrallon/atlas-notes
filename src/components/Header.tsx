import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Globe,
  Home,
  ListTodo,
  Map,
  Menu,
  Users,
  StickyNote,
  X,
} from 'lucide-react'
import BetterAuthHeader from '../integrations/better-auth/header-user.tsx'

// lib
import { useSession } from '@/lib/auth-client.ts'

// hooks
import { useUserAccess } from '@/hooks/use-user-access.ts'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const [groupedExpanded, setGroupedExpanded] = useState<
    Record<string, boolean>
  >({})
  const { data } = useSession()
  const { data: userAccess } = useUserAccess()

  const handleOpenDrawer = () => {
    setIsOpen(true)
  }

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center bg-gray-800 px-4 text-white shadow-lg">
        <button
          onClick={handleOpenDrawer}
          className="z-50 p-2 hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
        <h1 className="ml-4 text-xl font-semibold">
          <Link to="/">Atlas Notes</Link>
        </h1>
      </header>

      <aside
        className={`fixed top-0 left-0 h-full w-80 bg-gray-900 text-white shadow-2xl z-100 transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">Navigation</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <Link
            to="/"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
            activeProps={{
              className:
                'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2',
            }}
          >
            <Home size={20} />
            <span className="font-medium">Home</span>
          </Link>

          {data && (
            <Link
              to="/dashboard/todos"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
              activeProps={{
                className:
                  'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2',
              }}
            >
              <ListTodo size={20} />
              <span className="font-medium">Todos</span>
            </Link>
          )}

          <Link
            to="/dashboard/better-auth"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
            activeProps={{
              className:
                'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2',
            }}
          >
            <Globe size={20} />
            <span className="font-medium">Better Auth</span>
          </Link>

          {userAccess && userAccess.role === 'Admin' ? (
            <div>
              <div className="flex flex-row justify-between">
                <Link
                  to="/dashboard/users"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
                  activeProps={{
                    className:
                      'flex-1 flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2',
                  }}
                >
                  <Users size={20} />
                  <span className="font-medium">Users</span>
                </Link>
                <button
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors mb-2"
                  onClick={() =>
                    setGroupedExpanded((prev) => ({
                      ...prev,
                      userAccess: !prev.userAccess,
                    }))
                  }
                >
                  {groupedExpanded.userAccess ? (
                    <ChevronDown size={20} />
                  ) : (
                    <ChevronRight size={20} />
                  )}
                </button>
              </div>
              {groupedExpanded.userAccess && (
                <div className="flex flex-col ml-4">
                  <Link
                    to="/dashboard/user/permissions"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
                    activeProps={{
                      className:
                        'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2',
                    }}
                  >
                    <StickyNote size={20} />
                    <span className="font-medium">User Permissions</span>
                  </Link>
                </div>
              )}
            </div>
          ) : null}

          <Link
            to="/dashboard/maps"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors mb-2"
            activeProps={{
              className:
                'flex items-center gap-3 p-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 transition-colors mb-2',
            }}
          >
            <Map size={20} />
            <span className="font-medium">Map</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-700 bg-gray-800 flex flex-col gap-2">
          <BetterAuthHeader />
        </div>
      </aside>
    </>
  )
}
