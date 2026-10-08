import { createFileRoute } from '@tanstack/react-router'
import { useKline } from '@/hooks/api/useKline'
import { KlineView } from '@/components/views/KlineView'
export const Route = createFileRoute('/')({ component: HomePage })
function HomePage() {
  const market = useKline()
  return (
    <KlineView snapshot={market.data} loading={market.isPending} refreshing={market.isFetching} error={market.error?.message} onRefresh={() => { void market.refetch() }} />
  )
}
