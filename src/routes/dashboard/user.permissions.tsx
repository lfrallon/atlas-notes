import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/user/permissions')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/dashboard/user/permissions"!</div>
}
