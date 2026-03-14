export const roles = {
  USER: 'User',
  ADMIN: 'Admin',
  GUEST: 'Guest',
} as const

export type Role = (typeof roles)[keyof typeof roles]

export function isAuthorised(userRole: Role, requiredRoles: Role[]): boolean {
  const hierarchy: Record<Role, number> = {
    [roles.USER]: 0,
    [roles.GUEST]: 1,
    [roles.ADMIN]: 2,
  }

  return requiredRoles.some((role) => hierarchy[userRole] >= hierarchy[role])
}
