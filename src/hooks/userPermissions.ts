import { useRouter } from '@tanstack/react-router'

export function usePermissions() {
  const router = useRouter()
  const auth = router.options.context.auth

  return {
    hasRole: auth?.hasRole,
    hasAnyRole: auth?.hasAnyRole,
    hasPermission: auth?.hasPermission,
    hasAnyPermission: auth?.hasAnyPermission,
    user: auth?.user,
  }
}
