import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/permissions')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/dashboard/permissions"!</div>
}
