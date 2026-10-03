import { createFileRoute } from '@tanstack/react-router'
import { useHealth, useReadiness } from '@/hooks/api'
import { HomeView } from '@/components/views'
export const Route = createFileRoute('/')({ component: HomePage })
function HomePage() {
  const service = useHealth()
  const database = useReadiness()
  return (
    <HomeView
      service={{ connected: !!service.data, loading: service.isPending, error: service.error?.message }}
      database={{ connected: !!database.data, loading: database.isPending, error: database.error?.message }}
      refreshing={service.isFetching || database.isFetching}
      onRefresh={() => { void service.refetch(); void database.refetch() }}
    />
  )
}
